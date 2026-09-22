"use strict";

// Conexões de node configuráveis pelo admin, com múltiplas conexões salvas
// (ex: node de dev vs. de staging) e uma só ativa por vez por chain.
// Compartilhado entre server/bitcoin e server/ethereum — mesmo padrão dos
// outros módulos (better-sqlite3 síncrono, tabela criada aqui mesmo no
// require).
//
// O wallet-hub existe só pra alimentar saldo de teste nas carteiras do
// mybitcoin (sempre BTC regtest + ETH devnet/anvil-like) — por isso só um
// valor de rede é aceito por chain, sem mainnet/testnet: essa ferramenta
// nunca deve mexer com fundos reais.

const crypto = require("crypto");
const db = require("./db.js");

const NETWORKS_BY_CHAIN = {
	btc: ["regtest"],
	eth: ["anvil"]
};

// Campo sensível de cada chain, mascarado nas rotas GET (routes.js) como
// "••••••••". Ao editar, se o campo chegar mascarado ou vazio, mantemos o
// valor salvo em vez de sobrescrever com o placeholder.
const SENSITIVE_FIELD_BY_CHAIN = { btc: "rpcPassword", eth: "rpcToken" };
const MASK_PLACEHOLDER = "••••••••";

db.exec(`
	CREATE TABLE IF NOT EXISTS node_connections (
		id TEXT PRIMARY KEY,
		chain TEXT NOT NULL CHECK(chain IN ('btc','eth')),
		network TEXT NOT NULL,
		label TEXT NOT NULL,
		config TEXT NOT NULL,
		is_active INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL
	)
`);
db.exec(`
	CREATE UNIQUE INDEX IF NOT EXISTS idx_node_connections_one_active_per_chain
		ON node_connections(chain) WHERE is_active = 1
`);

const insertStmt = db.prepare(
	"INSERT INTO node_connections (id, chain, network, label, config, is_active, created_at) VALUES (@id, @chain, @network, @label, @config, @isActive, @createdAt)"
);
const listStmt = db.prepare(
	"SELECT id, chain, network, label, config, is_active AS isActive, created_at AS createdAt FROM node_connections WHERE chain = ? ORDER BY created_at ASC"
);
const getStmt = db.prepare(
	"SELECT id, chain, network, label, config, is_active AS isActive, created_at AS createdAt FROM node_connections WHERE id = ? AND chain = ?"
);
const getActiveStmt = db.prepare(
	"SELECT id, chain, network, label, config, is_active AS isActive, created_at AS createdAt FROM node_connections WHERE chain = ? AND is_active = 1"
);
const countForChainStmt = db.prepare("SELECT COUNT(*) AS count FROM node_connections WHERE chain = ?");
const deactivateAllStmt = db.prepare("UPDATE node_connections SET is_active = 0 WHERE chain = ?");
const activateStmt = db.prepare("UPDATE node_connections SET is_active = 1 WHERE id = ?");
const deleteStmt = db.prepare("DELETE FROM node_connections WHERE id = ? AND chain = ?");
const updateStmt = db.prepare(
	"UPDATE node_connections SET network = @network, label = @label, config = @config WHERE id = @id AND chain = @chain"
);

function parseRow(row) {
	if (!row) return row;
	return { ...row, isActive: Boolean(row.isActive), config: JSON.parse(row.config) };
}

function assertValidNetwork(chain, network) {
	const allowed = NETWORKS_BY_CHAIN[chain];
	if (!allowed) {
		throw new Error(`Chain inválida: ${chain}`);
	}
	if (!allowed.includes(network)) {
		throw new Error(`Rede inválida pra ${chain}: ${network} (use ${allowed.join(", ")}).`);
	}
}

function listConnections(chain) {
	return listStmt.all(chain).map(parseRow);
}

function getActiveConnection(chain) {
	const row = getActiveStmt.get(chain);
	if (!row) {
		throw new Error(`Nenhuma conexão ativa configurada pra ${chain}.`);
	}
	return parseRow(row);
}

// Cria a conexão. Por padrão nasce inativa (o admin ativa explicitamente
// depois, exceto no bootstrap do boot, que insere direto via SQL já ativa)
// — assim trocar de rede é sempre uma ação deliberada, nunca um efeito
// colateral de cadastrar uma conexão nova.
function createConnection({ chain, network, label, config }) {
	assertValidNetwork(chain, network);

	if (!label || !String(label).trim()) {
		throw new Error("Rótulo é obrigatório.");
	}
	if (!config || typeof config !== "object") {
		throw new Error("Configuração da conexão é obrigatória.");
	}

	const row = {
		id: crypto.randomUUID(),
		chain,
		network,
		label: String(label).trim(),
		config: JSON.stringify(config),
		isActive: 0,
		createdAt: new Date().toISOString()
	};

	insertStmt.run(row);
	return parseRow(getStmt.get(row.id, chain));
}

function activateConnection(chain, id) {
	const target = getStmt.get(id, chain);
	if (!target) {
		throw new Error(`Conexão não encontrada: ${id}`);
	}

	const tx = db.transaction(() => {
		deactivateAllStmt.run(chain);
		activateStmt.run(id);
	});
	tx();

	return parseRow(getStmt.get(id, chain));
}

// Edita uma conexão existente (rótulo e/ou config).
function updateConnection(chain, id, { network, label, config }) {
	const target = getStmt.get(id, chain);
	if (!target) {
		throw new Error(`Conexão não encontrada: ${id}`);
	}

	assertValidNetwork(chain, network);

	if (!label || !String(label).trim()) {
		throw new Error("Rótulo é obrigatório.");
	}
	if (!config || typeof config !== "object") {
		throw new Error("Configuração da conexão é obrigatória.");
	}

	const sensitiveField = SENSITIVE_FIELD_BY_CHAIN[chain];
	const mergedConfig = { ...config };
	if (sensitiveField && (!mergedConfig[sensitiveField] || mergedConfig[sensitiveField] === MASK_PLACEHOLDER)) {
		mergedConfig[sensitiveField] = JSON.parse(target.config)[sensitiveField];
	}

	updateStmt.run({
		id,
		chain,
		network,
		label: String(label).trim(),
		config: JSON.stringify(mergedConfig)
	});

	return parseRow(getStmt.get(id, chain));
}

function deleteConnection(chain, id) {
	const target = getStmt.get(id, chain);
	if (!target) {
		throw new Error(`Conexão não encontrada: ${id}`);
	}
	if (target.is_active || target.isActive) {
		throw new Error("Não é possível excluir a conexão ativa — ative outra antes.");
	}

	deleteStmt.run(id, chain);
}

// Usado só pelo bootstrap de compatibilidade no boot (server/index.js): cria
// a conexão já ativa a partir das env vars atuais, sem passar pela trava de
// mainnet (bootstrap nunca cria mainnet) nem pelo "nasce inativa" de cima.
function bootstrapConnection({ chain, network, label, config }) {
	assertValidNetwork(chain, network);

	const row = {
		id: crypto.randomUUID(),
		chain,
		network,
		label,
		config: JSON.stringify(config),
		isActive: 1,
		createdAt: new Date().toISOString()
	};

	insertStmt.run(row);
	return parseRow(getStmt.get(row.id, chain));
}

function hasAnyConnection(chain) {
	return countForChainStmt.get(chain).count > 0;
}

module.exports = {
	NETWORKS_BY_CHAIN,
	listConnections,
	getActiveConnection,
	createConnection,
	updateConnection,
	activateConnection,
	deleteConnection,
	bootstrapConnection,
	hasAnyConnection
};
