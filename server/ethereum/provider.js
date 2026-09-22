"use strict";

// Único ponto de acesso ao RPC Ethereum ativo (Anvil/devnet local,
// testnet ou mainnet) — a URL/token não vêm mais de env vars fixas, e sim
// da conexão ETH ativa em node_connections (server/connections.js),
// consultada a cada chamada (better-sqlite3 é síncrono e local — sem
// necessidade de cache, e evita ficar com provider velho depois de trocar
// de rede pela UI). O header X-RPC-Token (quando configurado) vai em toda
// chamada via FetchRequest do ethers — tanto as chamadas RPC cruas quanto
// o signer (ethers.Wallet) passam pelo mesmo provider autenticado.

const { ethers } = require("ethers");
const connections = require("../connections.js");

function getProvider() {
	const { config } = connections.getActiveConnection("eth");

	if (!config.rpcUrl) {
		throw new Error("Conexão Ethereum ativa não tem rpcUrl configurada.");
	}

	const fetchRequest = new ethers.FetchRequest(config.rpcUrl);
	if (config.rpcToken) {
		fetchRequest.setHeader("X-RPC-Token", config.rpcToken);
	}

	return new ethers.JsonRpcProvider(fetchRequest, undefined, { staticNetwork: false });
}

module.exports = { getProvider };
