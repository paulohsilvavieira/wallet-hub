"use strict";

const auth = require("./auth.js");

function requireAuth(req, res, next) {
	const user = auth.getUserByToken(req.cookies.sid);
	if (!user) {
		res.status(401).json({ error: "Não autenticado." });
		return;
	}
	req.user = { id: user.id, email: user.email, role: user.role };
	req.userId = user.id; // compat com código portado do wallet-console
	next();
}

function requireAdmin(req, res, next) {
	if (!req.user || req.user.role !== "admin") {
		res.status(403).json({ error: "Acesso restrito a administradores." });
		return;
	}
	next();
}

module.exports = { requireAuth, requireAdmin };
