import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const port = Number(process.env.MEMFY_TEST_PORT || 8799);
const tempDir = await mkdtemp(join(tmpdir(), "memfy-smoke-"));
const server = spawn(process.execPath, ["server/index.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(port), MEMFY_DB_PATH: join(tempDir, "memfy.sqlite") },
  stdio: ["ignore", "pipe", "pipe"],
});

const base = `http://127.0.0.1:${port}/api`;

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // The child process may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Memfy API did not start");
}

async function request(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error(`${options?.method || "GET"} ${path} failed: ${response.status}`);
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await waitForHealth();
  const initial = await request("/memories");
  assert(initial.length === 0, "fresh database was not empty");

  const memory = await request("/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Smoke test", body: "Persisted by the API", project: "Verification" }),
  });
  assert(memory.title === "Smoke test", "memory create failed");
  const recalled = await request(`/memories/${memory.id}/recall`, { method: "POST" });
  assert(recalled.recalls === 1, "recall tracking failed");
  const projects = await request("/projects");
  assert(projects[0]?.name === "Verification" && projects[0].memories === 1, "project derivation failed");
  await request("/apps/rest-api/connection", { method: "POST" });
  const agents = await request("/agents");
  assert(agents[0]?.name === "REST API", "agent derivation failed");
  await request(`/memories/${memory.id}`, { method: "DELETE" });
  await request("/apps/rest-api/connection", { method: "DELETE" });
  const final = await request("/stats");
  assert(final.memoryCount === 0 && final.connectionCount === 0, "cleanup failed");
  console.log("Memfy end-to-end smoke test passed");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolvePromise) => server.once("exit", resolvePromise));
  await rm(tempDir, { recursive: true, force: true });
}
