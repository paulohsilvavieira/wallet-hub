"use strict";

// Autenticação própria e simples: sessão via token aleatório persistido no
// mesmo SQLite (server/db.js), cookie httpOnly. Mesmo espírito do
// wallet-console original, estendido com `role` ('admin'|'user').
//
// Cadastro público (`signup`) sempre cria role='user'. O único jeito de
// existir um admin é `ensureAdminUser`, chamado no boot (server/index.js)
// com ADMIN_EMAIL/ADMIN_PASSWORD — não existe rota HTTP para promover
// usuário a admin.

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("./db.js");

const SESSION_DAYS = 30;

db.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
		created_at TEXT NOT NULL
	)
`);

db.exec(`
	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		created_at TEXT NOT NULL,
		expires_at TEXT NOT NULL
	)
`);

const insertUserStmt = db.prepare(
	"INSERT INTO users (id, email, password_hash, role, created_at) VALUES (@id, @email, @passwordHash, @role, @createdAt)"
);
const getUserByEmailStmt = db.prepare("SELECT * FROM users WHERE email = ?");
const getUserByIdStmt = db.prepare("SELECT id, email, role, created_at AS createdAt FROM users WHERE id = ?");
const countAdminsStmt = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
const promoteToAdminStmt = db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?");

const insertSessionStmt = db.prepare(
	"INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (@token, @userId, @createdAt, @expiresAt)"
);
const getSessionStmt = db.prepare("SELECT * FROM sessions WHERE token = ?");
const deleteSessionStmt = db.prepare("DELETE FROM sessions WHERE token = ?");
const deleteExpiredSessionsStmt = db.prepare("DELETE FROM sessions WHERE expires_at < ?");

function normalizeEmail(email) {
	return String(email || "").trim().toLowerCase();
}

function createSession(userId) {
	const token = crypto.randomBytes(32).toString("hex");
	const now = new Date();
	const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

	insertSessionStmt.run({
		token,
		userId,
		createdAt: now.toISOString(),
		expiresAt: expires.toISOString()
	});

	return token;
}

function toPublicUser(row) {
	return { id: row.id, email: row.email, role: row.role, createdAt: row.createdAt || row.created_at };
}

function signup(email, password) {
	email = normalizeEmail(email);

	if (!email || !email.includes("@")) {
		throw new Error("E-mail inválido.");
	}
	if (!password || password.length < 6) {
		throw new Error("Senha precisa ter pelo menos 6 caracteres.");
	}
	if (getUserByEmailStmt.get(email)) {
		throw new Error("Já existe uma conta com esse e-mail.");
	}

	const user = {
		id: crypto.randomUUID(),
		email,
		passwordHash: bcrypt.hashSync(password, 10),
		role: "user",
		createdAt: new Date().toISOString()
	};

	insertUserStmt.run(user);

	return { token: createSession(user.id), user: toPublicUser(user) };
}

function login(email, password) {
	email = normalizeEmail(email);

	const user = getUserByEmailStmt.get(email);
	if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
		throw new Error("E-mail ou senha inválidos.");
	}

	return { token: createSession(user.id), user: toPublicUser(user) };
}

function logout(token) {
	if (token) {
		deleteSessionStmt.run(token);
	}
}

function getUserByToken(token) {
	if (!token) {
		return null;
	}

	deleteExpiredSessionsStmt.run(new Date().toISOString());

	const session = getSessionStmt.get(token);
	if (!session) {
		return null;
	}

	return getUserByIdStmt.get(session.user_id) || null;
}

// Chamado uma vez no boot do servidor. Idempotente: se já existe algum
// admin, não faz nada (mesmo que ADMIN_EMAIL/ADMIN_PASSWORD estejam
// setados). Se não existe admin e as env vars estão presentes, promove um
// usuário já existente com esse e-mail, ou cria um novo.
function ensureAdminUser(email, password) {
	if (!email || !password) {
		return;
	}

	if (countAdminsStmt.get().count > 0) {
		return;
	}

	const normalized = normalizeEmail(email);
	const existing = getUserByEmailStmt.get(normalized);

	if (existing) {
		promoteToAdminStmt.run(bcrypt.hashSync(password, 10), existing.id);
		console.log(`[auth] Usuário existente promovido a admin: ${normalized}`);
		return;
	}

	insertUserStmt.run({
		id: crypto.randomUUID(),
		email: normalized,
		passwordHash: bcrypt.hashSync(password, 10),
		role: "admin",
		createdAt: new Date().toISOString()
	});
	console.log(`[auth] Admin criado no boot: ${normalized}`);
}

module.exports = {
	signup,
	login,
	logout,
	getUserByToken,
	ensureAdminUser,
	SESSION_DAYS
};
