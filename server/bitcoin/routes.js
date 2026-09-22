"use strict";

const express = require("express");

const walletRpc = require("./walletRpc.js");
const localWallet = require("./localWallet.js");
const history = require("./history.js");
const connections = require("../connections.js");
const { requireAdmin } = require("../middleware.js");

const DAILY_LIMIT_BTC = 3;
const CHAIN = "btc";

const router = express.Router();

// --- Conexões de node (admin-only) ---

function maskConnection(conn) {
	const config = { ...conn.config };
	if (config.rpcPassword) config.rpcPassword = "••••••••";
	return { ...conn, config };
}

router.get("/connections", requireAdmin, (req, res) => {
	res.json(connections.listConnections(CHAIN).map(maskConnection));
});

router.post("/connections", requireAdmin, (req, res) => {
	const { network, label, config } = req.body;
	try {
		const created = connections.createConnection({ chain: CHAIN, network, label, config });
		res.json(maskConnection(created));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.put("/connections/:id", requireAdmin, (req, res) => {
	const { network, label, config } = req.body;
	try {
		const updated = connections.updateConnection(CHAIN, req.params.id, { network, label, config });
		res.json(maskConnection(updated));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.post("/connections/:id/activate", requireAdmin, (req, res) => {
	try {
		res.json(maskConnection(connections.activateConnection(CHAIN, req.params.id)));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.delete("/connections/:id", requireAdmin, (req, res) => {
	try {
		connections.deleteConnection(CHAIN, req.params.id);
		res.json({ ok: true });
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

// --- Carteiras do node (bitcoind) — só admin gerencia ---

router.get("/wallets", requireAdmin, async (req, res) => {
	try {
		const onDisk = await walletRpc.listWalletDir();
		const loaded = await walletRpc.listLoadedWallets();

		const wallets = await Promise.all(onDisk.map(async (name) => {
			const isLoaded = loaded.includes(name);
			let balances = null;

			if (isLoaded) {
				try {
					balances = await walletRpc.getBalances(name);
				} catch (e) {
					// segue sem saldo pra essa wallet
				}
			}

			return { name, loaded: isLoaded, balances };
		}));

		res.json(wallets);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

router.post("/wallets", requireAdmin, async (req, res) => {
	const name = (req.body.name || "").trim();

	if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
		res.status(400).json({ error: "Nome de carteira inválido (use letras, números, - ou _)." });
		return;
	}

	try {
		res.json(await walletRpc.createOrLoadWallet(name));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.post("/wallets/:name/address", requireAdmin, async (req, res) => {
	try {
		const address = await walletRpc.getNewAddress(req.params.name);
		res.json({ address });
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

// --- Envio — compartilhado entre admin e usuário comum, com limite diário
// por endereço de destino pra role='user' ---

router.post("/send", async (req, res) => {
	const { address, amount, feeRate } = req.body;

	if (!address) {
		res.status(400).json({ error: "Endereço é obrigatório." });
		return;
	}

	const amt = Number(amount);
	if (!Number.isFinite(amt) || amt <= 0) {
		res.status(400).json({ error: "Valor precisa ser um número maior que zero." });
		return;
	}

	try {
		const active = connections.getActiveConnection(CHAIN);

		const validation = await walletRpc.validateAddress(address);
		if (!validation.isvalid) {
			res.status(400).json({ error: `Endereço inválido: ${address}` });
			return;
		}

		if (req.user.role === "user") {
			const alreadySentToday = history.sumSentToAddressToday(address, active.network);
			if (alreadySentToday + amt > DAILY_LIMIT_BTC) {
				res.status(400).json({
					error: `Limite diário de ${DAILY_LIMIT_BTC} BTC por endereço de destino excedido (já enviado hoje pra esse endereço: ${alreadySentToday} BTC).`
				});
				return;
			}
		}

		let fr = 2; // sat/vB — o node não tem fallbackfee configurado
		if (feeRate) {
			fr = Number(feeRate);
			if (!Number.isFinite(fr) || fr <= 0) {
				res.status(400).json({ error: "Fee rate precisa ser um número maior que zero." });
				return;
			}
		}

		const walletName = active.config.walletName;

		// Garante que a wallet do node está carregada (idempotente).
		await walletRpc.createOrLoadWallet(walletName);

		const txid = await walletRpc.sendToAddress(walletName, { address, amount: amt, feeRate: fr });

		// `generatetoaddress` só existe em regtest (testnet/mainnet confirmam
		// via mineradores reais) — auto-mine só faz sentido nessa rede.
		if (active.network === "regtest") {
			const minerAddress = await walletRpc.getNewAddress(walletName);
			await walletRpc.generateToAddress(1, minerAddress);
		}

		const entry = history.addSend({
			txid,
			fromWallet: walletName,
			address,
			amount: amt,
			network: active.network,
			userId: req.user.id,
			at: new Date().toISOString()
		});

		res.json(entry);
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.get("/history", (req, res) => {
	const userId = req.user.role === "admin" ? undefined : req.user.id;
	res.json(history.listSends({ userId }));
});

// --- Contas de teste locais (chave própria, só recebimento) — admin-only ---

router.get("/accounts", requireAdmin, (req, res) => {
	res.json(localWallet.listAccounts(req.user.id));
});

router.post("/accounts", requireAdmin, (req, res) => {
	const label = (req.body.label || "").trim();
	res.json(localWallet.createAccount(req.user.id, label));
});

router.post("/accounts/:id/rename", requireAdmin, (req, res) => {
	const label = (req.body.label || "").trim();

	try {
		res.json(localWallet.renameAccount(req.params.id, req.user.id, label));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.delete("/accounts/:id", requireAdmin, (req, res) => {
	try {
		localWallet.deleteAccount(req.params.id, req.user.id);
		res.json({ ok: true });
	} catch (e) {
		res.status(404).json({ error: e.message });
	}
});

router.post("/accounts/:id/reveal", requireAdmin, (req, res) => {
	try {
		res.json(localWallet.revealSecret(req.params.id, req.user.id));
	} catch (e) {
		res.status(404).json({ error: e.message });
	}
});

router.get("/accounts/:id/balance", requireAdmin, async (req, res) => {
	let account;
	try {
		account = localWallet.getAccount(req.params.id, req.user.id);
	} catch (e) {
		res.status(404).json({ error: e.message });
		return;
	}

	try {
		const result = await walletRpc.scanTxOutSet(`addr(${account.address})`);
		res.json({ confirmed: result.total_amount || 0, utxoCount: (result.unspents || []).length });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

module.exports = router;
