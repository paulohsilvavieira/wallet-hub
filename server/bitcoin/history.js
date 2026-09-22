"use strict";

// Histórico de envios feitos pela carteira do node (auto-minerada) —
// persistido em SQLite. Renomeada de `sends` (wallet-console) para
// `bitcoin_sends`, com `user_id` pra permitir o limite diário por usuário
// comum e a filtragem de histórico (admin vê tudo, usuário só o próprio).

const db = require("../db.js");

db.exec(`
	CREATE TABLE IF NOT EXISTS bitcoin_sends (
		txid TEXT PRIMARY KEY,
		from_wallet TEXT NOT NULL,
		address TEXT NOT NULL,
		amount REAL NOT NULL,
		user_id TEXT,
		at TEXT NOT NULL
	)
`);

db.exec("CREATE INDEX IF NOT EXISTS idx_bitcoin_sends_address_at ON bitcoin_sends(address, at)");

const insertStmt = db.prepare(
	"INSERT INTO bitcoin_sends (txid, from_wallet, address, amount, user_id, at) VALUES (@txid, @fromWallet, @address, @amount, @userId, @at)"
);
const listAllStmt = db.prepare(
	"SELECT txid, from_wallet AS fromWallet, address, amount, user_id AS userId, at FROM bitcoin_sends ORDER BY at DESC LIMIT 50"
);
const listByUserStmt = db.prepare(
	"SELECT txid, from_wallet AS fromWallet, address, amount, user_id AS userId, at FROM bitcoin_sends WHERE user_id = ? ORDER BY at DESC LIMIT 50"
);
// Soma por calendário UTC (não é janela rolante de 24h) — `at` é sempre
// gravado como ISO 8601 UTC, então `date(at)` funciona direto no SQLite.
const sumTodayByAddressStmt = db.prepare(
	"SELECT COALESCE(SUM(amount), 0) AS total FROM bitcoin_sends WHERE address = ? AND date(at) = date('now')"
);

function addSend(entry) {
	insertStmt.run(entry);
	return entry;
}

function listSends({ userId } = {}) {
	return userId ? listByUserStmt.all(userId) : listAllStmt.all();
}

function sumSentToAddressToday(address) {
	return sumTodayByAddressStmt.get(address).total || 0;
}

module.exports = {
	addSend,
	listSends,
	sumSentToAddressToday
};
