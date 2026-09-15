# Memfy

Memfy is a small, end-to-end memory dashboard. The working data path is a Node HTTP API backed by SQLite; the React UI talks to that API instead of seeding or storing demo records in the browser.

## What is implemented

- Empty database on first run — no demo memories, projects, agents, connections, or credentials.
- Memory CRUD: create, list/search, recall-count tracking, and delete.
- Persistent app-route registration backed by the database.
- Projects and agents derived from stored records.
- API health, statistics, validation, request-size limits, and explicit UI error states.
- Production server that serves both the API and the built frontend.

Third-party OAuth adapters, public authentication, hosted database provisioning, and an MCP protocol adapter are not implemented in this repository. The UI labels those capabilities as unavailable rather than displaying fake connection states or sample keys.

## Local development

Requirements: Node.js 22.5 or newer and npm. Node 22.5+ is required for the built-in `node:sqlite` module.

Install dependencies and start the API in one terminal:

```bash
npm install
npm run api
```

Start Vite in a second terminal:

```bash
npm run dev
```

Open the local URL printed by Vite. Vite proxies `/api` requests to `http://127.0.0.1:8787`.

The database is created at `data/memfy.sqlite`. Set `MEMFY_DB_PATH` or `MEMFY_DATA_DIR` to choose another location.

## Production-like run

```bash
npm run build
npm start
```

The server serves the built frontend and API together at `http://localhost:8787`.

## API

```text
GET    /api/health
GET    /api/stats
GET    /api/apps
POST   /api/apps/:appId/connection
DELETE /api/apps/:appId/connection
GET    /api/memories?q=optional-search
POST   /api/memories
POST   /api/memories/:id/recall
DELETE /api/memories/:id
GET    /api/projects
GET    /api/agents
DELETE /api/data
```

Example:

```bash
curl -X POST http://localhost:8787/api/memories \
  -H 'Content-Type: application/json' \
  -d '{"title":"A useful fact","body":"Saved through the live API","project":"General"}'
```

## Project structure

```text
server/index.mjs  SQLite API and production static server
src/App.jsx       React dashboard and data-driven UI
src/api.js        Frontend API client
src/index.css     Layout and responsive styles
vite.config.mjs   React plugin and development API proxy
```

## License

MIT
