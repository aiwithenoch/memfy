export const API_BASE = "/api";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Memfy API is unavailable. Start it with npm run api.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload;
}

export const api = {
  getDashboardData() {
    return Promise.all([
      request("/health"),
      request("/memories"),
      request("/apps"),
      request("/projects"),
      request("/agents"),
      request("/stats"),
    ]).then(([health, memories, apps, projects, agents, stats]) => ({
      health,
      memories,
      apps,
      projects,
      agents,
      stats,
    }));
  },
  createMemory(memory) {
    return request("/memories", { method: "POST", body: JSON.stringify(memory) });
  },
  recallMemory(id) {
    return request(`/memories/${encodeURIComponent(id)}/recall`, { method: "POST" });
  },
  deleteMemory(id) {
    return request(`/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  connectApp(id) {
    return request(`/apps/${encodeURIComponent(id)}/connection`, { method: "POST" });
  },
  disconnectApp(id) {
    return request(`/apps/${encodeURIComponent(id)}/connection`, { method: "DELETE" });
  },
  clearData() {
    return request("/data", { method: "DELETE" });
  },
};
