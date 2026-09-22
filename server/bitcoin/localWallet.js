"use strict";

// Geração de "contas" locais (endereço + chave privada) no estilo MetaMask:
// a chave nasce aqui, o bitcoind nunca fica sabendo dela até alguém mandar
// fundos pro endereço. Sem wallet no node, só recebimento.
//
// Persistido em SQLite (arquivo no volume /data) — sobrevive a restart do container.
// Escopado por usuário (user_id) — cada usuário só vê/mexe nas próprias contas.

const crypto = require("crypto");
const bip39 = require("bip39");
const ecc = require("tiny-secp256k1");
const { BIP32Factory } = require("bip32");
const bitcoinjs = require("bitcoinjs-lib");
const db = require("../db.js");
const connections = require("../connections.js");

const bip32 = BIP32Factory(ecc);

// Parâmetros reais do Bitcoin Core para regtest (chainparams.cpp): mesmos
// prefixos base58 do testnet, HRP bech32 "bcrt".
const REGTEST_NETWORK = {
	messagePrefix: "\x18Bitcoin Signed Message:\n",
	bech32: "bcrt",
	bip32: { public: 0x043587cf, private: 0x04358394 },
	pubKeyHash: 0x6f,
	scriptHash: 0xc4,
	wif: 0xef
};

// Endereço/chave de uma rede não fazem sentido em outra (um bcrt1... nunca é
// spendable em mainnet) — cada rede BTC ativa usa seus próprios parâmetros
// bech32/versionbyte na hora de derivar o endereço.
function networkParamsFor(network) {
	if (network === "mainnet") return bitcoinjs.networks.bitcoin;
	if (network === "testnet") return bitcoinjs.networks.testnet;
	return REGTEST_NETWORK; // regtest (default)
}

db.exec(`
	CREATE TABLE IF NOT EXISTS accounts (
		id TEXT PRIMARY KEY,
		label TEXT NOT NULL,
		address TEXT NOT NULL,
		mnemonic TEXT NOT NULL,
		private_key_wif TEXT NOT NULL,
		created_at TEXT NOT NULL
	)
`);

// Migração: adiciona user_id se a tabela já existia de antes (contas criadas
// sem dono ficam com user_id NULL, inacessíveis por qualquer usuário — é dado
// de teste, aceitável).
const accountColumns = db.prepare("PRAGMA table_info(accounts)").all().map((c) => c.name);
if (!accountColumns.includes("user_id")) {
	db.exec("ALTER TABLE accounts ADD COLUMN user_id TEXT");
}
// Migração: adiciona `network` — contas antigas (de antes de node_connections
// existir) ficam com 'regtest', a rede padrão de sempre desse app.
if (!accountColumns.includes("network")) {
	db.exec("ALTER TABLE accounts ADD COLUMN network TEXT NOT NULL DEFAULT 'regtest'");
}

const insertStmt = db.prepare(
	"INSERT INTO accounts (id, label, address, mnemonic, private_key_wif, network, created_at, user_id) VALUES (@id, @label, @address, @mnemonic, @privateKeyWIF, @network, @createdAt, @userId)"
);
const listStmt = db.prepare("SELECT id, label, address, network, created_at AS createdAt FROM accounts WHERE user_id = ? AND network = ? ORDER BY created_at DESC");
const getStmt = db.prepare("SELECT id, label, address, mnemonic, private_key_wif AS privateKeyWIF, network, created_at AS createdAt FROM accounts WHERE id = ? AND user_id = ?");
const getPublicStmt = db.prepare("SELECT id, label, address, network, created_at AS createdAt FROM accounts WHERE id = ? AND user_id = ?");
const countStmt = db.prepare("SELECT COUNT(*) AS count FROM accounts WHERE user_id = ? AND network = ?");
const updateLabelStmt = db.prepare("UPDATE accounts SET label = ? WHERE id = ? AND user_id = ?");
const deleteStmt = db.prepare("DELETE FROM accounts WHERE id = ? AND user_id = ?");

function createAccount(userId, label) {
	const { network } = connections.getActiveConnection("btc");
	const networkParams = networkParamsFor(network);

	const mnemonic = bip39.generateMnemonic();
	const seed = bip39.mnemonicToSeedSync(mnemonic);
	const root = bip32.fromSeed(seed, networkParams);

	const { address } = bitcoinjs.payments.p2wpkh({ pubkey: root.publicKey, network: networkParams });

	const account = {
		id: crypto.randomUUID(),
		label: label || `Conta ${countStmt.get(userId, network).count + 1}`,
		address,
		mnemonic,
		privateKeyWIF: root.toWIF(),
		network,
		createdAt: new Date().toISOString(),
		userId
	};

	insertStmt.run(account);

	return account;
}

// Só contas cujo `network` bate com a rede BTC ativa no momento — contas de
// outra rede não fazem sentido misturadas na listagem (endereço/chave de
// regtest não vale em mainnet, e vice-versa).
function listAccounts(userId) {
	const { network } = connections.getActiveConnection("btc");
	return listStmt.all(userId, network);
}

function getAccount(id, userId) {
	const account = getStmt.get(id, userId);
	if (!account) {
		throw new Error(`Conta não encontrada: ${id}`);
	}
	return account;
}

function revealSecret(id, userId) {
	const { mnemonic, privateKeyWIF } = getAccount(id, userId);
	return { mnemonic, privateKeyWIF };
}

function renameAccount(id, userId, label) {
	getAccount(id, userId); // garante que existe e pertence ao usuário (lança se não)

	if (!label) {
		throw new Error("Rótulo não pode ser vazio.");
	}

	updateLabelStmt.run(label, id, userId);

	return getPublicStmt.get(id, userId);
}

function deleteAccount(id, userId) {
	getAccount(id, userId); // garante que existe e pertence ao usuário (lança se não)

	deleteStmt.run(id, userId);
}

module.exports = {
	createAccount,
	listAccounts,
	getAccount,
	revealSecret,
	renameAccount,
	deleteAccount
};
