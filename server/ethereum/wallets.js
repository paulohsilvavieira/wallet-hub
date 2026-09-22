"use strict";

// Carteiras de origem Ethereum — compartilhadas entre todos os usuários
// logados, geridas só pelo admin. Persistidas em SQLite (mesmo padrão do
// server/bitcoin/localWallet.js). A chave privada nunca sai daqui: as
// funções de leitura pública (listWallets/getWalletPublic) nunca a
// devolvem; só getWalletForSend, usado internamente pela rota de envio.

const crypto = require("crypto");
const { ethers } = require("ethers");
const db = require("../db.js");
const anvilRpc = require("./anvilRpc.js");

// Mnemonic de desenvolvimento padrão do Anvil/Hardhat — as 10 primeiras
// contas que `eth_accounts` devolve normalmente nascem dele. Se o Anvil da
// stack de referência foi iniciado com esse mnemonic (não é garantido —
// pode ter sido customizado), conseguimos derivar a chave privada; senão a
// carteira fica sem chave e o envio usa eth_sendTransaction sem assinatura.
const ANVIL_DEFAULT_MNEMONIC = "test test test test test test test test test test test junk";
const ANVIL_DERIVE_MAX_INDEX = 20;

db.exec(`
	CREATE TABLE IF NOT EXISTS ethereum_wallets (
		id TEXT PRIMARY KEY,
		label TEXT NOT NULL,
		address TEXT NOT NULL UNIQUE,
		private_key TEXT,
		created_at TEXT NOT NULL
	)
`);

const insertStmt = db.prepare(
	"INSERT INTO ethereum_wallets (id, label, address, private_key, created_at) VALUES (@id, @label, @address, @privateKey, @createdAt)"
);
const listPublicStmt = db.prepare(`
	SELECT id, label, address, created_at AS createdAt, (private_key IS NOT NULL) AS hasPrivateKey
	FROM ethereum_wallets ORDER BY created_at ASC
`);
const getPublicStmt = db.prepare(`
	SELECT id, label, address, created_at AS createdAt, (private_key IS NOT NULL) AS hasPrivateKey
	FROM ethereum_wallets WHERE id = ?
`);
const getFullByIdStmt = db.prepare("SELECT id, label, address, private_key AS privateKey, created_at AS createdAt FROM ethereum_wallets WHERE id = ?");
const getFullByAddressStmt = db.prepare("SELECT id, label, address, private_key AS privateKey, created_at AS createdAt FROM ethereum_wallets WHERE address = ? COLLATE NOCASE");
const firstWalletStmt = db.prepare("SELECT id, label, address, private_key AS privateKey, created_at AS createdAt FROM ethereum_wallets ORDER BY created_at ASC LIMIT 1");
const updateLabelStmt = db.prepare("UPDATE ethereum_wallets SET label = ? WHERE id = ?");
const deleteStmt = db.prepare("DELETE FROM ethereum_wallets WHERE id = ?");

function toBoolRow(row) {
	if (!row) return row;
	return { ...row, hasPrivateKey: Boolean(row.hasPrivateKey) };
}

function listWallets() {
	return listPublicStmt.all().map(toBoolRow);
}

function getWalletPublic(id) {
	const row = getPublicStmt.get(id);
	if (!row) throw new Error(`Carteira não encontrada: ${id}`);
	return toBoolRow(row);
}

// Uso interno (rota de envio) — inclui a chave privada, se houver.
function getWalletForSend(id) {
	return getFullByIdStmt.get(id) || null;
}

function firstWalletForSend() {
	return firstWalletStmt.get() || null;
}

function deriveAnvilPrivateKeyForAddress(address) {
	try {
		const root = ethers.HDNodeWallet.fromPhrase(ANVIL_DEFAULT_MNEMONIC, undefined, "m/44'/60'/0'/0");
		for (let i = 0; i < ANVIL_DERIVE_MAX_INDEX; i++) {
			const child = root.deriveChild(i);
			if (child.address.toLowerCase() === address.toLowerCase()) {
				return child.privateKey;
			}
		}
	} catch (e) {
		// segue sem chave
	}
	return null;
}

function addWalletFromPrivateKey(label, privateKey) {
	let wallet;
	try {
		wallet = new ethers.Wallet(privateKey.trim());
	} catch (e) {
		throw new Error("Chave privada inválida.");
	}

	if (getFullByAddressStmt.get(wallet.address)) {
		throw new Error("Já existe uma carteira cadastrada com esse endereço.");
	}

	const row = {
		id: crypto.randomUUID(),
		label: label || wallet.address,
		address: wallet.address,
		privateKey: wallet.privateKey,
		createdAt: new Date().toISOString()
	};

	insertStmt.run(row);
	return getWalletPublic(row.id);
}

async function importFromAnvil() {
	const accounts = await anvilRpc.ethAccounts();
	const imported = [];

	for (const address of accounts) {
		if (getFullByAddressStmt.get(address)) {
			continue;
		}

		const privateKey = deriveAnvilPrivateKeyForAddress(address);
		const row = {
			id: crypto.randomUUID(),
			label: `Anvil ${address.slice(0, 6)}…${address.slice(-4)}`,
			address,
			privateKey,
			createdAt: new Date().toISOString()
		};

		insertStmt.run(row);
		imported.push(getWalletPublic(row.id));
	}

	return imported;
}

function renameWallet(id, label) {
	getWalletPublic(id); // garante que existe (lança se não)

	if (!label) {
		throw new Error("Rótulo não pode ser vazio.");
	}

	updateLabelStmt.run(label, id);
	return getWalletPublic(id);
}

function deleteWallet(id) {
	getWalletPublic(id); // garante que existe (lança se não)
	deleteStmt.run(id);
}

module.exports = {
	listWallets,
	getWalletPublic,
	getWalletForSend,
	firstWalletForSend,
	addWalletFromPrivateKey,
	importFromAnvil,
	renameWallet,
	deleteWallet
};
