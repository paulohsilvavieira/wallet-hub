"use strict";

const { getProvider } = require("./provider.js");

function ethAccounts() {
	return getProvider().send("eth_accounts", []);
}

function getBalance(address) {
	return getProvider().getBalance(address); // bigint (wei)
}

// Usado só quando a carteira não tem chave privada salva (import do Anvil
// sem mnemonic padrão batendo) — o Anvil aceita `eth_sendTransaction` sem
// assinatura pras contas que ele mesmo controla.
function sendUnsignedTransaction(tx) {
	return getProvider().send("eth_sendTransaction", [tx]);
}

function getTransactionReceipt(hash) {
	return getProvider().getTransactionReceipt(hash);
}

// Faucet: credita saldo instantaneamente, sem gastar de nenhuma conta.
function setBalance(address, hexWei) {
	return getProvider().send("anvil_setBalance", [address, hexWei]);
}

module.exports = {
	ethAccounts,
	getBalance,
	sendUnsignedTransaction,
	getTransactionReceipt,
	setBalance,
	getProvider
};
