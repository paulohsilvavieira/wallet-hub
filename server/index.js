"use strict";

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const auth = require("./auth.js");
const bitcoinRoutes = require("./bitcoin/routes.js");
const ethereumRoutes = require("./ethereum/routes.js");
const { requireAuth } = require("./middleware.js");

const PORT = process.env.PORT || 3005;
const COOKIE_SECURE = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true";
const SESSION_COOKIE_MAX_AGE = auth.SESSION_DAYS * 24 * 60 * 60 * 1000;

// Cadastro de admin é fechado: sem rota pública. Se ainda não existe nenhum
// role='admin' e as env vars estiverem setadas, cria/promove esse usuário
// aqui, uma vez, no boot (idempotente — não faz nada em boots seguintes).
auth.ensureAdminUser(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

const app = express();

app.use(express.json());
app.use(cookieParser());

function setSessionCookie(res, token) {
	res.cookie("sid", token, {
		httpOnly: true,
		sameSite: "lax",
		secure: COOKIE_SECURE,
		maxAge: SESSION_COOKIE_MAX_AGE
	});
}

const router = express.Router();

// --- Autenticação ---
// POST /auth/signup é cadastro público, sempre cria role='user'.

router.post("/auth/signup", (req, res) => {
	try {
		const { token, user } = auth.signup(req.body.email, req.body.password);
		setSessionCookie(res, token);
		res.json({ user });
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.post("/auth/login", (req, res) => {
	try {
		const { token, user } = auth.login(req.body.email, req.body.password);
		setSessionCookie(res, token);
		res.json({ user });
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

router.post("/auth/logout", (req, res) => {
	auth.logout(req.cookies.sid);
	res.clearCookie("sid");
	res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
	const user = auth.getUserByToken(req.cookies.sid);
	if (!user) {
		res.status(401).json({ error: "Não autenticado." });
		return;
	}
	res.json({ user });
});

// A partir daqui, tudo exige sessão válida.
router.use(requireAuth);

router.use("/btc", bitcoinRoutes);
router.use("/eth", ethereumRoutes);

app.use("/api", router);

const staticDir = path.join(__dirname, "..", "dist");
app.use(express.static(staticDir));
app.get(/^(?!\/api\/).*/, (req, res) => {
	res.sendFile(path.join(staticDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
	console.log(`wallet-hub ouvindo na porta ${PORT}`);
});
