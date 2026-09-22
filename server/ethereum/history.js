"use strict";

// Histórico de envios Ethereum — assinados/enviados pelo backend. Guarda o
// valor exato em wei (TEXT, pra não perder precisão de bigint) e também em
// ETH (REAL) só pra facilitar a soma do limite diário por endereço, no
// mesmo espírito de bitcoin_sends.amount.

const db = require("../db.js");

db.exec(`
	CREATE TABLE IF NOT EXISTS ethereum_sends (
		hash TEXT PRIMARY KEY,
		wallet_id TEXT,
		from_address TEXT NOT NULL,
		to_address TEXT NOT NULL,
		value_wei TEXT NOT NULL,
		amount_eth REAL NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		block_number INTEGER,
		gas_used TEXT,
		error TEXT,
		user_id TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)
`);

db.exec("CREATE INDEX IF NOT EXISTS idx_ethereum_sends_to_at ON ethereum_sends(to_address, created_at)");

// Migração: coluna `network` pra escopar o limite diário por rede — sem
// isso, trocar a conexão ativa reseta o limite incorretamente (ou soma
// valores de redes diferentes como se fossem a mesma). Registros antigos
// (de antes de node_connections existir) ficam com 'anvil', a rede padrão
// de sempre desse app.
const ethereumSendsColumns = db.prepare("PRAGMA table_info(ethereum_sends)").all().map((c) => c.name);
if (!ethereumSendsColumns.includes("network")) {
	db.exec("ALTER TABLE ethereum_sends ADD COLUMN network TEXT NOT NULL DEFAULT 'anvil'");
}

const insertStmt = db.prepare(`
	INSERT INTO ethereum_sends
		(hash, wallet_id, from_address, to_address, value_wei, amount_eth, status, network, user_id, created_at, updated_at)
	VALUES
		(@hash, @walletId, @fromAddress, @toAddress, @valueWei, @amountEth, @status, @network, @userId, @createdAt, @updatedAt)
`);
const updateStatusStmt = db.prepare(`
	UPDATE ethereum_sends
	SET status = ?, block_number = COALESCE(?, block_number), gas_used = COALESCE(?, gas_used), error = COALESCE(?, error), updated_at = ?
	WHERE hash = ?
`);
const getByHashStmt = db.prepare(`
	SELECT hash, wallet_id AS walletId, from_address AS fromAddress, to_address AS toAddress,
		value_wei AS valueWei, amount_eth AS amountEth, status, network, block_number AS blockNumber,
		gas_used AS gasUsed, error, user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
	FROM ethereum_sends WHERE hash = ?
`);
const listAllStmt = db.prepare(`
	SELECT hash, wallet_id AS walletId, from_address AS fromAddress, to_address AS toAddress,
		value_wei AS valueWei, amount_eth AS amountEth, status, network, block_number AS blockNumber,
		gas_used AS gasUsed, error, user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
	FROM ethereum_sends ORDER BY created_at DESC LIMIT 50
`);
const listByUserStmt = db.prepare(`
	SELECT hash, wallet_id AS walletId, from_address AS fromAddress, to_address AS toAddress,
		value_wei AS valueWei, amount_eth AS amountEth, status, network, block_number AS blockNumber,
		gas_used AS gasUsed, error, user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
	FROM ethereum_sends WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
`);
const listPendingStmt = db.prepare("SELECT hash FROM ethereum_sends WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20");
// Endereços ETH têm checksum (mistura de maiúsculas/minúsculas) — soma por
// LOWER() pra não deixar o limite diário escapar por causa disso. Filtrado
// também por `network`: o limite diário é por rede, senão trocar de rede
// reseta o limite incorretamente ou mistura valores de redes diferentes.
const sumTodayByAddressStmt = db.prepare(
	"SELECT COALESCE(SUM(amount_eth), 0) AS total FROM ethereum_sends WHERE LOWER(to_address) = LOWER(?) AND network = ? AND date(created_at) = date('now')"
);

function addSend(entry) {
	insertStmt.run(entry);
	return getByHashStmt.get(entry.hash);
}

function updateStatus(hash, { status, blockNumber, gasUsed, error }) {
	updateStatusStmt.run(status, blockNumber ?? null, gasUsed ?? null, error ?? null, new Date().toISOString(), hash);
}

function getByHash(hash) {
	return getByHashStmt.get(hash);
}

function listSends({ userId } = {}) {
	return userId ? listByUserStmt.all(userId) : listAllStmt.all();
}

function listPendingHashes() {
	return listPendingStmt.all().map((r) => r.hash);
}

function sumSentToAddressToday(address, network) {
	return sumTodayByAddressStmt.get(address, network).total || 0;
}

module.exports = {
	addSend,
	updateStatus,
	getByHash,
	listSends,
	listPendingHashes,
	sumSentToAddressToday
};
