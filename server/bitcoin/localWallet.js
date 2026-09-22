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

const insertStmt = db.prepare(
	"INSERT INTO accounts (id, label, address, mnemonic, private_key_wif, created_at, user_id) VALUES (@id, @label, @address, @mnemonic, @privateKeyWIF, @createdAt, @userId)"
);
const listStmt = db.prepare("SELECT id, label, address, created_at AS createdAt FROM accounts WHERE user_id = ? ORDER BY created_at DESC");
const getStmt = db.prepare("SELECT id, label, address, mnemonic, private_key_wif AS privateKeyWIF, created_at AS createdAt FROM accounts WHERE id = ? AND user_id = ?");
const getPublicStmt = db.prepare("SELECT id, label, address, created_at AS createdAt FROM accounts WHERE id = ? AND user_id = ?");
const countStmt = db.prepare("SELECT COUNT(*) AS count FROM accounts WHERE user_id = ?");
const updateLabelStmt = db.prepare("UPDATE accounts SET label = ? WHERE id = ? AND user_id = ?");
const deleteStmt = db.prepare("DELETE FROM accounts WHERE id = ? AND user_id = ?");

function createAccount(userId, label) {
	const mnemonic = bip39.generateMnemonic();
	const seed = bip39.mnemonicToSeedSync(mnemonic);
	const root = bip32.fromSeed(seed, REGTEST_NETWORK);

	const { address } = bitcoinjs.payments.p2wpkh({ pubkey: root.publicKey, network: REGTEST_NETWORK });

	const account = {
		id: crypto.randomUUID(),
		label: label || `Conta ${countStmt.get(userId).count + 1}`,
		address,
		mnemonic,
		privateKeyWIF: root.toWIF(),
		createdAt: new Date().toISOString(),
		userId
	};

	insertStmt.run(account);

	return account;
}

function listAccounts(userId) {
	return listStmt.all(userId);
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
