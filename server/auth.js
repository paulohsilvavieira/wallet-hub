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
const getUserByIdFullStmt = db.prepare("SELECT * FROM users WHERE id = ?");
const promoteToAdminStmt = db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?");
const listUsersStmt = db.prepare("SELECT id, email, role, created_at AS createdAt FROM users WHERE role != 'admin' ORDER BY created_at ASC");
const updatePasswordStmt = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
const deleteSessionsForUserStmt = db.prepare("DELETE FROM sessions WHERE user_id = ?");

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

// Chamado a cada boot do servidor. ADMIN_EMAIL/ADMIN_PASSWORD são a fonte
// da verdade do admin: se o usuário já existe, sincroniza senha+role toda
// vez (assim trocar a senha é só editar o .env e reiniciar o container,
// sem precisar mexer no banco); se não existe, cria. Não mexe em outros
// admins que porventura existam (ex: promovidos manualmente no banco).
function ensureAdminUser(email, password) {
	if (!email || !password) {
		return;
	}

	const normalized = normalizeEmail(email);
	const existing = getUserByEmailStmt.get(normalized);
	const passwordHash = bcrypt.hashSync(password, 10);

	if (existing) {
		if (existing.role === "admin" && bcrypt.compareSync(password, existing.password_hash)) {
			return; // já está em dia, evita re-hash/log a cada restart
		}
		promoteToAdminStmt.run(passwordHash, existing.id);
		console.log(`[auth] Admin sincronizado a partir do .env: ${normalized}`);
		return;
	}

	insertUserStmt.run({
		id: crypto.randomUUID(),
		email: normalized,
		passwordHash,
		role: "admin",
		createdAt: new Date().toISOString()
	});
	console.log(`[auth] Admin criado no boot: ${normalized}`);
}

// Recuperação de conta é admin-assistida (o wallet-hub não tem infra de
// e-mail): admin gera uma senha temporária aleatória pro usuário, mostrada
// só na hora, e o repasse é por fora (chat, presencial, etc). Derruba as
// sessões existentes desse usuário, forçando login de novo com a nova senha.
function listUsers() {
	return listUsersStmt.all();
}

function resetUserPassword(userId) {
	const user = getUserByIdFullStmt.get(userId);
	if (!user) {
		throw new Error("Usuário não encontrado.");
	}

	const tempPassword = crypto.randomBytes(9).toString("base64url"); // 12 chars, url-safe
	updatePasswordStmt.run(bcrypt.hashSync(tempPassword, 10), userId);
	deleteSessionsForUserStmt.run(userId);

	return { user: toPublicUser(user), tempPassword };
}

module.exports = {
	signup,
	login,
	logout,
	getUserByToken,
	ensureAdminUser,
	listUsers,
	resetUserPassword,
	SESSION_DAYS
};
