"use strict";

const express = require("express");
const { ethers } = require("ethers");

const anvilRpc = require("./anvilRpc.js");
const wallets = require("./wallets.js");
const history = require("./history.js");
const { requireAdmin } = require("../middleware.js");

const DAILY_LIMIT_ETH = 3;
const FAUCET_MAX_ETH = 1_000_000;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const router = express.Router();

// --- Carteiras compartilhadas — só admin gerencia ---

router.get("/wallets", requireAdmin, async (req, res) => {
	try {
		const list = wallets.listWallets();
		const withBalances = await Promise.all(list.map(async (w) => {
			try {
				const balanceWei = await anvilRpc.getBalance(w.address);
				return { ...w, balanceWei: balanceWei.toString(), balanceEth: ethers.formatEther(balanceWei) };
			} catch (e) {
				return { ...w, balanceWei: null, balanceEth: null };
			}
		}));
		res.json(withBalances);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

router.post("/wallets", requireAdmin, (req, res) => {
	const label = (req.body.label || "").trim();
	const privateKey = (req.body.privateKey || "").trim();

	if (!privateKey) {
		res.status(400).json({ error: "Chave privada é obrigatória." });
		return;
	}

	try {
		res.json(wallets.addWalletFromPrivateKey(label, privateKey));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.post("/wallets/import-anvil", requireAdmin, async (req, res) => {
	try {
		res.json(await wallets.importFromAnvil());
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.post("/wallets/:id/rename", requireAdmin, (req, res) => {
	const label = (req.body.label || "").trim();

	try {
		res.json(wallets.renameWallet(req.params.id, label));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.delete("/wallets/:id", requireAdmin, (req, res) => {
	try {
		wallets.deleteWallet(req.params.id);
		res.json({ ok: true });
	} catch (e) {
		res.status(404).json({ error: e.message });
	}
});

// --- Faucet (admin-only) — credita saldo instantaneamente via anvil_setBalance ---

router.post("/faucet", requireAdmin, async (req, res) => {
	const address = (req.body.address || "").trim();
	const amt = Number(req.body.amountEth);

	if (!ADDRESS_RE.test(address)) {
		res.status(400).json({ error: "Endereço inválido." });
		return;
	}
	if (!Number.isFinite(amt) || amt <= 0 || amt > FAUCET_MAX_ETH) {
		res.status(400).json({ error: "Valor precisa ser um número maior que zero." });
		return;
	}

	try {
		const current = await anvilRpc.getBalance(address);
		const addWei = ethers.parseEther(String(amt));
		const newBalance = current + addWei;
		await anvilRpc.setBalance(address, "0x" + newBalance.toString(16));
		res.json({ address, newBalanceWei: newBalance.toString(), newBalanceEth: ethers.formatEther(newBalance) });
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

// --- Envio — compartilhado, com limite diário por endereço de destino pra
// role='user'. Assinatura e envio 100% no backend. ---

router.post("/send", async (req, res) => {
	const address = (req.body.address || "").trim();
	const amt = Number(req.body.amountEth);
	const walletId = req.body.walletId;

	if (!ADDRESS_RE.test(address)) {
		res.status(400).json({ error: "Endereço inválido." });
		return;
	}
	if (!Number.isFinite(amt) || amt <= 0) {
		res.status(400).json({ error: "Valor precisa ser um número maior que zero." });
		return;
	}

	try {
		let wallet;

		if (req.user.role === "admin") {
			if (!walletId) {
				res.status(400).json({ error: "Selecione a carteira de origem." });
				return;
			}
			wallet = wallets.getWalletForSend(walletId);
			if (!wallet) {
				res.status(400).json({ error: "Carteira não encontrada." });
				return;
			}
		} else {
			wallet = wallets.firstWalletForSend();
			if (!wallet) {
				res.status(400).json({ error: "Nenhuma carteira Ethereum cadastrada ainda. Peça para o admin cadastrar uma." });
				return;
			}

			const alreadySentToday = history.sumSentToAddressToday(address);
			if (alreadySentToday + amt > DAILY_LIMIT_ETH) {
				res.status(400).json({
					error: `Limite diário de ${DAILY_LIMIT_ETH} ETH por endereço de destino excedido (já enviado hoje pra esse endereço: ${alreadySentToday} ETH).`
				});
				return;
			}
		}

		const valueWei = ethers.parseEther(String(amt));
		let txHash;

		if (wallet.privateKey) {
			const signer = new ethers.Wallet(wallet.privateKey, anvilRpc.getProvider());
			const tx = await signer.sendTransaction({ to: address, value: valueWei });
			txHash = tx.hash;
		} else {
			// Sem chave salva (import do Anvil que não bateu com o mnemonic
			// padrão) — o Anvil aceita enviar sem assinatura pras contas dele.
			txHash = await anvilRpc.sendUnsignedTransaction({
				from: wallet.address,
				to: address,
				value: "0x" + valueWei.toString(16)
			});
		}

		const now = new Date().toISOString();
		history.addSend({
			hash: txHash,
			walletId: wallet.id,
			fromAddress: wallet.address,
			toAddress: address,
			valueWei: valueWei.toString(),
			amountEth: amt,
			status: "pending",
			userId: req.user.id,
			createdAt: now,
			updatedAt: now
		});

		// Tenta confirmar na hora; se o bloco ainda não saiu (Anvil pode ter
		// block time configurado em dezenas de segundos), fica "pending" e o
		// GET /history mais adiante re-consulta o recibo — sem poller em
		// background, decisão simples pra manter o backend sem estado extra.
		try {
			const receipt = await anvilRpc.getTransactionReceipt(txHash);
			if (receipt) {
				history.updateStatus(txHash, {
					status: Number(receipt.status) === 1 ? "confirmed" : "failed",
					blockNumber: Number(receipt.blockNumber),
					gasUsed: receipt.gasUsed?.toString()
				});
			}
		} catch (e) {
			// segue pending
		}

		res.json(history.getByHash(txHash));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.get("/history", async (req, res) => {
	const userId = req.user.role === "admin" ? undefined : req.user.id;

	// Reconsulta o recibo dos envios ainda pendentes antes de responder —
	// forma simples de manter o status atualizado sem job em background.
	try {
		const pending = history.listPendingHashes();
		await Promise.all(pending.map(async (hash) => {
			try {
				const receipt = await anvilRpc.getTransactionReceipt(hash);
				if (receipt) {
					history.updateStatus(hash, {
						status: Number(receipt.status) === 1 ? "confirmed" : "failed",
						blockNumber: Number(receipt.blockNumber),
						gasUsed: receipt.gasUsed?.toString()
					});
				}
			} catch (e) {
				// segue pending
			}
		}));
	} catch (e) {
		// se o RPC estiver fora do ar, ainda devolve o histórico salvo
	}

	res.json(history.listSends({ userId }));
});

module.exports = router;
