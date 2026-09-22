"use strict";

// Único ponto de acesso ao RPC do Anvil: sempre via o proxy HTTPS do
// `ethereum-local-explorer` (ANVIL_RPC_URL, algo como
// https://eth.explorer.mybitcoin.ptechsistemas.com/rpc), nunca direto numa
// porta 8545. O header X-RPC-Token vai em toda chamada, carregado pelo
// FetchRequest do ethers — assim tanto as chamadas RPC cruas (eth_accounts,
// eth_getBalance, anvil_setBalance) quanto o signer (ethers.Wallet) passam
// pelo mesmo provider autenticado.

const { ethers } = require("ethers");

const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL;
const ANVIL_RPC_TOKEN = process.env.ANVIL_RPC_TOKEN;

let cachedProvider = null;

function getProvider() {
	if (!ANVIL_RPC_URL) {
		throw new Error("ANVIL_RPC_URL não configurada — RPC do Anvil não está acessível.");
	}

	if (cachedProvider) {
		return cachedProvider;
	}

	const fetchRequest = new ethers.FetchRequest(ANVIL_RPC_URL);
	if (ANVIL_RPC_TOKEN) {
		fetchRequest.setHeader("X-RPC-Token", ANVIL_RPC_TOKEN);
	}

	cachedProvider = new ethers.JsonRpcProvider(fetchRequest, undefined, { staticNetwork: true });
	return cachedProvider;
}

module.exports = { getProvider };
