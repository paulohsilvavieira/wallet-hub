"use strict";

const http = require("http");

const RPC_HOST = process.env.RPC_HOST || "bitcoin-node";
const RPC_PORT = process.env.RPC_PORT || 18443;
const RPC_USER = process.env.RPC_USER || "admin";
const RPC_PASSWORD = process.env.RPC_PASSWORD || "admin";

function rpcCall(method, params, walletName) {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify({ jsonrpc: "1.0", id: "wallet-console", method, params: params || [] });
		const auth = Buffer.from(`${RPC_USER}:${RPC_PASSWORD}`).toString("base64");

		const req = http.request(
			{
				hostname: RPC_HOST,
				port: RPC_PORT,
				path: walletName ? `/wallet/${encodeURIComponent(walletName)}` : "/",
				method: "POST",
				headers: {
					"Content-Type": "text/plain",
					"Authorization": `Basic ${auth}`,
					"Content-Length": Buffer.byteLength(body)
				}
			},
			(res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					let parsed;
					try {
						parsed = JSON.parse(data);
					} catch (e) {
						reject(new Error(`Resposta inválida do node (HTTP ${res.statusCode}): ${data.slice(0, 200)}`));
						return;
					}

					if (parsed.error) {
						reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
					} else {
						resolve(parsed.result);
					}
				});
			}
		);

		req.on("error", reject);
		req.write(body);
		req.end();
	});
}

function listWalletDir() {
	return rpcCall("listwalletdir").then((result) => result.wallets.map((w) => w.name));
}

function listLoadedWallets() {
	return rpcCall("listwallets");
}

async function createOrLoadWallet(name) {
	const onDisk = await listWalletDir();
	const loaded = await listLoadedWallets();

	if (loaded.includes(name)) {
		return { name, created: false };
	}

	if (onDisk.includes(name)) {
		await rpcCall("loadwallet", [name]);
		return { name, created: false };
	}

	await rpcCall("createwallet", [name]);
	return { name, created: true };
}

function getBalances(wallet) {
	return rpcCall("getbalances", [], wallet).then((balances) => balances.mine);
}

function getNewAddress(wallet) {
	return rpcCall("getnewaddress", [], wallet);
}

function validateAddress(address) {
	return rpcCall("validateaddress", [address]);
}

function sendToAddress(wallet, { address, amount, feeRate }) {
	const params = { address, amount };
	if (feeRate) {
		params.fee_rate = feeRate;
	}
	return rpcCall("sendtoaddress", params, wallet);
}

function generateToAddress(nblocks, address) {
	return rpcCall("generatetoaddress", [nblocks, address]);
}

function scanTxOutSet(descriptor) {
	return rpcCall("scantxoutset", ["start", [descriptor]]);
}

module.exports = {
	listWalletDir,
	listLoadedWallets,
	createOrLoadWallet,
	getBalances,
	getNewAddress,
	validateAddress,
	sendToAddress,
	generateToAddress,
	scanTxOutSet
};
