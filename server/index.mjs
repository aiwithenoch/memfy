import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(process.env.MEMFY_DATA_DIR || join(ROOT_DIR, "data"));
const DB_PATH = resolve(process.env.MEMFY_DB_PATH || join(DATA_DIR, "memfy.sqlite"));
const DIST_DIR = resolve(join(ROOT_DIR, "dist"));
const PORT = Number(process.env.PORT || 8787);
const SERVE_DIST = process.argv.includes("--serve-dist");
const MAX_BODY_BYTES = 1_000_000;
const CORS_ORIGIN = process.env.MEMFY_CORS_ORIGIN || "*";

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    project TEXT NOT NULL DEFAULT 'General',
    source TEXT NOT NULL DEFAULT 'Manual Add',
    recalls INTEGER NOT NULL DEFAULT 0 CHECK (recalls >= 0),
    importance TEXT NOT NULL DEFAULT 'Medium' CHECK (importance IN ('Low', 'Medium', 'High')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status = 'connected'),
    connected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS memories_updated_at_idx ON memories(updated_at DESC);
  CREATE INDEX IF NOT EXISTS memories_project_idx ON memories(project);
`);

// These are capabilities implemented by this repository, not user records.
// A connection is never marked active until the user explicitly registers it.
const SUPPORTED_APPS = [
  {
    id: "rest-api",
    name: "REST API",
    type: "Persistent HTTP memory route",
    badge: "Core",
  },
];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    Vary: "Origin",
  });
  res.end(body);
}

function empty(res, status = 204) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    Vary: "Origin",
  });
  res.end();
}

function now() {
  return new Date().toISOString();
}

function toMemory(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    project: row.project,
    source: row.source,
    recalls: row.recalls,
    importance: row.importance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getMemory(id) {
  return toMemory(db.prepare("SELECT * FROM memories WHERE id = ?").get(id));
}

function getStats() {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM memories) AS memory_count,
      (SELECT COALESCE(SUM(recalls), 0) FROM memories) AS recall_count,
      (SELECT COUNT(*) FROM connections WHERE status = 'connected') AS connection_count
  `).get();
  return {
    memoryCount: Number(row.memory_count),
    recallCount: Number(row.recall_count),
    connectionCount: Number(row.connection_count),
  };
}

function getApps() {
  const connected = new Set(
    db.prepare("SELECT app_id FROM connections WHERE status = 'connected'").all().map((row) => row.app_id),
  );
  return SUPPORTED_APPS.map((app) => ({
    ...app,
    status: connected.has(app.id) ? "connected" : "available",
  }));
}

function getApp(appId) {
  return SUPPORTED_APPS.find((app) => app.id === appId) || null;
}

function parseMemoryInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "A JSON object is required");
  }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const project = typeof input.project === "string" ? input.project.trim() : "";
  const source = typeof input.source === "string" ? input.source.trim() : "";
  const importance = typeof input.importance === "string" ? input.importance : "Medium";

  if (!title || title.length > 160) throw new HttpError(400, "Title must be 1–160 characters");
  if (!body || body.length > 20_000) throw new HttpError(400, "Content must be 1–20,000 characters");
  if (project.length > 120) throw new HttpError(400, "Project must be 120 characters or fewer");
  if (source.length > 120) throw new HttpError(400, "Source must be 120 characters or fewer");
  if (!["Low", "Medium", "High"].includes(importance)) throw new HttpError(400, "Importance is invalid");

  return {
    title,
    body,
    project: project || "General",
    source: source || "Manual Add",
    importance,
  };
}

async function readJson(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large");
    chunks.push(chunk);
  }
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

async function handleApi(req, res, url) {
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/api/health") {
    json(res, 200, { ok: true, storage: "sqlite", database: "ready" });
    return;
  }

  if (req.method === "GET" && path === "/api/stats") {
    json(res, 200, getStats());
    return;
  }

  if (req.method === "GET" && path === "/api/apps") {
    json(res, 200, getApps());
    return;
  }

  const appConnectionMatch = path.match(/^\/api\/apps\/([^/]+)\/connection$/);
  if (appConnectionMatch && ["POST", "DELETE"].includes(req.method)) {
    const appId = decodeURIComponent(appConnectionMatch[1]);
    if (!getApp(appId)) throw new HttpError(404, "App route is not configured");
    if (req.method === "POST") {
      const timestamp = now();
      db.prepare(`
        INSERT INTO connections (id, app_id, status, connected_at, updated_at)
        VALUES (?, ?, 'connected', ?, ?)
        ON CONFLICT(app_id) DO UPDATE SET status = 'connected', updated_at = excluded.updated_at
      `).run(randomUUID(), appId, timestamp, timestamp);
      json(res, 200, getApps().find((app) => app.id === appId));
    } else {
      db.prepare("DELETE FROM connections WHERE app_id = ?").run(appId);
      empty(res);
    }
    return;
  }

  if (req.method === "GET" && path === "/api/memories") {
    const search = (url.searchParams.get("q") || "").trim();
    const rows = search
      ? db.prepare(`
          SELECT * FROM memories
          WHERE title LIKE ? OR body LIKE ? OR project LIKE ? OR source LIKE ?
          ORDER BY updated_at DESC
        `).all(...[search, search, search, search].map((value) => `%${value}%`))
      : db.prepare("SELECT * FROM memories ORDER BY updated_at DESC").all();
    json(res, 200, rows.map(toMemory));
    return;
  }

  if (req.method === "POST" && path === "/api/memories") {
    const input = parseMemoryInput(await readJson(req));
    const id = randomUUID();
    const timestamp = now();
    db.prepare(`
      INSERT INTO memories (id, title, body, project, source, recalls, importance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(id, input.title, input.body, input.project, input.source, input.importance, timestamp, timestamp);
    json(res, 201, getMemory(id));
    return;
  }

  const recallMatch = path.match(/^\/api\/memories\/([^/]+)\/recall$/);
  if (req.method === "POST" && recallMatch) {
    const id = decodeURIComponent(recallMatch[1]);
    const result = db.prepare("UPDATE memories SET recalls = recalls + 1, updated_at = ? WHERE id = ?").run(now(), id);
    if (Number(result.changes) === 0) throw new HttpError(404, "Memory not found");
    json(res, 200, getMemory(id));
    return;
  }

  const memoryMatch = path.match(/^\/api\/memories\/([^/]+)$/);
  if (req.method === "DELETE" && memoryMatch) {
    const id = decodeURIComponent(memoryMatch[1]);
    const result = db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    if (Number(result.changes) === 0) throw new HttpError(404, "Memory not found");
    empty(res);
    return;
  }

  if (req.method === "GET" && path === "/api/projects") {
    const rows = db.prepare(`
      SELECT project AS name, COUNT(*) AS memories, COALESCE(SUM(recalls), 0) AS recalls
      FROM memories
      GROUP BY project
      ORDER BY MAX(updated_at) DESC, project ASC
    `).all();
    json(res, 200, rows.map((row) => ({ name: row.name, memories: Number(row.memories), recalls: Number(row.recalls) })));
    return;
  }

  if (req.method === "GET" && path === "/api/agents") {
    const connections = db.prepare("SELECT app_id, connected_at FROM connections WHERE status = 'connected' ORDER BY connected_at DESC").all();
    json(res, 200, connections.map((connection) => {
      const app = getApp(connection.app_id);
      return {
        id: connection.app_id,
        name: app?.name || connection.app_id,
        status: "Connected",
        route: app?.type || "Configured route",
        connectedAt: connection.connected_at,
      };
    }));
    return;
  }

  if (req.method === "DELETE" && path === "/api/data") {
    db.exec("DELETE FROM memories; DELETE FROM connections;");
    json(res, 200, { deleted: true, ...getStats() });
    return;
  }

  throw new HttpError(404, "API route not found");
}

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(DIST_DIR, requestedPath));
  if (!filePath.startsWith(`${DIST_DIR}/`) && filePath !== DIST_DIR) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  try {
    if (!statSync(filePath).isFile()) throw new Error("Not a file");
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch {
    if (extname(pathname)) {
      json(res, 404, { error: "File not found" });
      return;
    }
    serveStatic(res, "/index.html");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (SERVE_DIST && req.method === "GET") {
      serveStatic(res, url.pathname);
      return;
    }
    json(res, 404, { error: "Not found" });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error(error);
    json(res, status, { error: error instanceof Error ? error.message : "Internal server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Memfy API listening on http://localhost:${PORT}`);
  if (SERVE_DIST) console.log(`Memfy app available at http://localhost:${PORT}`);
});

function close() {
  db.close();
  server.close(() => process.exit(0));
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
