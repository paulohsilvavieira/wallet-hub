"use strict";

const express = require("express");
const { ethers } = require("ethers");

const anvilRpc = require("./anvilRpc.js");
const wallets = require("./wallets.js");
const history = require("./history.js");
const connections = require("../connections.js");
const { requireAdmin } = require("../middleware.js");

const DAILY_LIMIT_ETH = 3;
const FAUCET_MAX_ETH = 1_000_000;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CHAIN = "eth";

const router = express.Router();

async function sendFromWallet(wallet, address, valueWei) {
	if (wallet.privateKey) {
		const signer = new ethers.Wallet(wallet.privateKey, anvilRpc.getProvider());
		const tx = await signer.sendTransaction({ to: address, value: valueWei });
		return tx.hash;
	}
	// Sem chave salva (import do Anvil que não bateu com o mnemonic padrão)
	// — o Anvil aceita enviar sem assinatura pras contas dele.
	return anvilRpc.sendUnsignedTransaction({
		from: wallet.address,
		to: address,
		value: "0x" + valueWei.toString(16)
	});
}

function isInsufficientFundsError(e) {
	const msg = String((e && e.message) || "").toLowerCase();
	return e?.code === "INSUFFICIENT_FUNDS" || msg.includes("insufficient funds");
}

// --- Conexões de node (admin-only) ---

function maskConnection(conn) {
	const config = { ...conn.config };
	if (config.rpcToken) config.rpcToken = "••••••••";
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

// --- Carteiras compartilhadas — só admin gerencia ---

router.get("/wallets", requireAdmin, async (req, res) => {
	try {
		const active = connections.getActiveConnection(CHAIN);
		const list = wallets.listWallets(active.network);
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
		const active = connections.getActiveConnection(CHAIN);
		res.json(wallets.addWalletFromPrivateKey(label, privateKey, active.network));
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.post("/wallets/import-anvil", requireAdmin, async (req, res) => {
	try {
		const active = connections.getActiveConnection(CHAIN);
		res.json(await wallets.importFromAnvil(active.network));
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
		const active = connections.getActiveConnection(CHAIN);
		const valueWei = ethers.parseEther(String(amt));

		let wallet;
		let txHash;

		if (req.user.role === "admin") {
			if (!walletId) {
				res.status(400).json({ error: "Selecione a carteira de origem." });
				return;
			}
			wallet = wallets.getWalletForSend(walletId, active.network);
			if (!wallet) {
				res.status(400).json({ error: "Carteira não encontrada." });
				return;
			}

			txHash = await sendFromWallet(wallet, address, valueWei);
		} else {
			const candidates = wallets.listWalletsForSend(active.network);
			if (candidates.length === 0) {
				res.status(400).json({ error: "Nenhuma carteira Ethereum cadastrada ainda. Peça para o admin cadastrar uma." });
				return;
			}

			const alreadySentToday = history.sumSentToAddressToday(address, active.network);
			if (alreadySentToday + amt > DAILY_LIMIT_ETH) {
				res.status(400).json({
					error: `Limite diário de ${DAILY_LIMIT_ETH} ETH por endereço de destino excedido (já enviado hoje pra esse endereço: ${alreadySentToday} ETH).`
				});
				return;
			}

			// Tenta a primeira carteira cadastrada; se ela não tiver saldo
			// suficiente, passa pra próxima, na ordem de cadastro. Só falha de
			// vez se nenhuma tiver saldo.
			for (const candidate of candidates) {
				try {
					txHash = await sendFromWallet(candidate, address, valueWei);
					wallet = candidate;
					break;
				} catch (e) {
					if (!isInsufficientFundsError(e)) throw e;
				}
			}

			if (!wallet) {
				res.status(400).json({
					error: "Nenhuma carteira ETH com saldo suficiente pra esse envio. Peça pro admin recarregar via faucet."
				});
				return;
			}
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
			network: active.network,
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
