"use strict";

const express = require("express");

const walletRpc = require("./walletRpc.js");
const localWallet = require("./localWallet.js");
const history = require("./history.js");
const { requireAdmin } = require("../middleware.js");

// Wallet do node usada por `/send` — a mesma wallet auto-minerada pelo
// container bitcoin-node (ver docker-compose.yml do repo `bitcoin`,
// WALLET_NAME default "bitcoin-wallet-regtest"). O usuário comum não
// escolhe carteira de origem, então isso precisa ser fixo.
const WALLET_NAME = process.env.WALLET_NAME || "bitcoin-wallet-regtest";
const DAILY_LIMIT_BTC = 3;

const router = express.Router();

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
		const validation = await walletRpc.validateAddress(address);
		if (!validation.isvalid) {
			res.status(400).json({ error: `Endereço inválido: ${address}` });
			return;
		}

		if (req.user.role === "user") {
			const alreadySentToday = history.sumSentToAddressToday(address);
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

		// Garante que a wallet do node está carregada (idempotente).
		await walletRpc.createOrLoadWallet(WALLET_NAME);

		const txid = await walletRpc.sendToAddress(WALLET_NAME, { address, amount: amt, feeRate: fr });

		const minerAddress = await walletRpc.getNewAddress(WALLET_NAME);
		await walletRpc.generateToAddress(1, minerAddress);

		const entry = history.addSend({
			txid,
			fromWallet: WALLET_NAME,
			address,
			amount: amt,
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
