import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Brain,
  CircleDollarSign,
  Command,
  Copy,
  Database,
  Gauge,
  KeyRound,
  Layers3,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { api, API_BASE } from "./api.js";

function useLocalState(key, initial, isValid = () => true) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initial;
    try {
      const stored = localStorage.getItem(key);
      const parsed = stored !== null ? JSON.parse(stored) : initial;
      return isValid(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // A route preference should never prevent the dashboard from rendering.
    }
  }, [key, value]);

  return [value, setValue];
}

const routes = [
  { id: "home", label: "Home", icon: Gauge },
  { id: "connect", label: "Connect Apps", icon: Unplug },
  { id: "install", label: "Install", icon: Terminal },
  { id: "memories", label: "Memories", icon: Brain },
  { id: "agents", label: "Agents", icon: Layers3 },
  { id: "projects", label: "Projects", icon: Database },
  { id: "api", label: "API", icon: KeyRound },
  { id: "mcp", label: "MCP", icon: Command },
  { id: "cli", label: "CLI", icon: Terminal },
  { id: "billing", label: "Billing", icon: CircleDollarSign },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: ShieldCheck },
];

const isRoute = (value) => typeof value === "string" && routes.some((route) => route.id === value);
const EMPTY_STATS = { memoryCount: 0, recallCount: 0, connectionCount: 0 };

function browserApiBase() {
  if (typeof window === "undefined") return API_BASE;
  return `${window.location.origin}${API_BASE}`;
}

function formatDateTime(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatRelativeTime(value) {
  if (!value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function copyText(value, notify) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Clipboard copy failed");
    }
    notify("Copied");
  } catch {
    notify("Copy failed — select the text manually");
  }
}

function getConnectionCommand(app) {
  const base = browserApiBase();
  if (app?.id === "rest-api") {
    return `curl -X POST ${base}/memories \\
  -H "Content-Type: application/json" \\
  -d '{"title":"A useful fact","body":"Replace this with a real memory","project":"General"}'`;
  }
  return `# ${app?.name || "Memfy"}\n# This route is not configured in this deployment.`;
}

function ModalShell({ titleId, onClose, className = "", children }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [...(modalRef.current?.querySelectorAll("button, input, textarea, [href], [tabindex]:not([tabindex=\"-1\"])") || [])].filter((element) => !element.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const focusTarget = modalRef.current?.querySelector("[data-autofocus]") || modalRef.current?.querySelector("button, input, textarea");
      focusTarget?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`modal ${className}`.trim()}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function App() {
  return <Shell />;
}

function Shell() {
  const [active, setActive] = useLocalState("memfy_active", "home", isRoute);
  const [appFilter, setAppFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [data, setData] = useState({ health: null, memories: [], apps: [], projects: [], agents: [], stats: EMPTY_STATS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [showAddMemory, setShowAddMemory] = useState(false);
  const toastTimer = useRef(null);
  const searchInputRef = useRef(null);

  const showToast = useCallback((message, duration = 2200) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    if (message) toastTimer.current = window.setTimeout(() => setToast(""), duration);
  }, []);

  const loadData = useCallback(async (withLoading = true) => {
    if (withLoading) setLoading(true);
    setError("");
    try {
      const next = await api.getDashboardData();
      setData(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Memfy data");
    } finally {
      if (withLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [loadData]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setActive("connect");
      setMobileOpen(false);
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [setActive]);

  const title = useMemo(() => (active === "connect" ? "Apps" : routes.find((route) => route.id === active)?.label || "Home"), [active]);
  const visibleApps = useMemo(() => data.apps.filter((app) => {
    const matchesTab = appFilter === "connected" ? app.status === "connected" : true;
    const matchesQuery = `${app.name} ${app.type} ${app.badge}`.toLowerCase().includes(query.toLowerCase());
    return matchesTab && matchesQuery;
  }), [appFilter, data.apps, query]);
  const dataRoute = ["home", "connect", "memories", "agents", "projects", "settings"].includes(active);

  const navigate = (route) => {
    setActive(route);
    setMobileOpen(false);
  };

  const confirmConnection = async () => {
    if (!selectedApp) return;
    const app = selectedApp;
    setBusyAction(`app:${app.id}`);
    try {
      if (app.status === "connected") {
        await api.disconnectApp(app.id);
        showToast(`${app.name} route disconnected`);
      } else {
        await api.connectApp(app.id);
        showToast(`${app.name} route connected`);
      }
      setSelectedApp(null);
      await loadData(false);
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : "Could not update the connection");
    } finally {
      setBusyAction("");
    }
  };

  const saveMemory = async (memory) => {
    setBusyAction("memory:create");
    try {
      await api.createMemory(memory);
      setShowAddMemory(false);
      await loadData(false);
      showToast("Memory saved");
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : "Could not save memory");
    } finally {
      setBusyAction("");
    }
  };

  const recallMemory = async (memory) => {
    setBusyAction(`memory:${memory.id}`);
    try {
      await api.recallMemory(memory.id);
      await loadData(false);
      showToast("Recall recorded");
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : "Could not record recall");
    } finally {
      setBusyAction("");
    }
  };

  const deleteMemory = async (memory) => {
    if (!window.confirm(`Delete “${memory.title}”? This cannot be undone.`)) return;
    setBusyAction(`memory:${memory.id}`);
    try {
      await api.deleteMemory(memory.id);
      await loadData(false);
      showToast("Memory deleted");
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : "Could not delete memory");
    } finally {
      setBusyAction("");
    }
  };

  const clearData = async () => {
    if (!window.confirm("Delete every memory and connection from the Memfy database? This cannot be undone.")) return;
    setBusyAction("data:clear");
    try {
      await api.clearData();
      await loadData(false);
      showToast("All server data deleted");
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : "Could not delete server data");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="app">
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      <div className="layout">
        <Sidebar active={active} setActive={navigate} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <main className="main">
          <header className="topbar">
            <div className="topbar-inner">
              <div className="topbar-title-row">
                <button onClick={() => setMobileOpen(true)} className="icon-btn mobile-only" aria-label="Open navigation"><Menu size={20} /></button>
                <h1>{title}</h1>
              </div>
              {active === "connect" && (
                <div className="top-actions">
                  <div className="search-box"><Search size={16} /><input ref={searchInputRef} type="search" aria-label="Search apps" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></div>
                </div>
              )}
            </div>
          </header>
          <section className="content">
            {dataRoute && loading && <LoadingState />}
            {dataRoute && !loading && error && <ErrorState message={error} onRetry={() => loadData()} />}
            {(!dataRoute || (!loading && !error)) && (
              <>
                {active === "home" && <Home memories={data.memories} stats={data.stats} health={data.health} onRefresh={() => loadData()} />}
                {active === "connect" && <Connect apps={visibleApps} appFilter={appFilter} setAppFilter={setAppFilter} onConnect={setSelectedApp} />}
                {active === "install" && <Install setToast={showToast} />}
                {active === "memories" && <Memories memories={data.memories} onAdd={() => setShowAddMemory(true)} onRecall={recallMemory} onDelete={deleteMemory} busyAction={busyAction} />}
                {active === "agents" && <Agents items={data.agents} />}
                {active === "projects" && <Projects items={data.projects} />}
                {active === "api" && <DevPanel title="REST API" description="The API is backed by SQLite and is the live data path for this repository. Authentication is not enabled by default, so protect it before exposing it publicly." warning="No API key is generated by this local deployment." command={`Base URL: ${browserApiBase()}\nHealth: GET ${browserApiBase()}/health\nMemories: GET ${browserApiBase()}/memories\nCreate: POST ${browserApiBase()}/memories`} setToast={showToast} />}
                {active === "mcp" && <DevPanel title="MCP adapter" description="An MCP protocol server is not implemented in this repository yet. This page intentionally does not show a fake endpoint or credential." warning="Use the REST API route until an MCP adapter is configured." command={`MCP status: not configured\nREST API: ${browserApiBase()}`} setToast={showToast} />}
                {active === "cli" && <DevPanel title="CLI workflow" description="There is no published Memfy CLI package in this repository. Use the working API directly from a terminal." command={`curl ${browserApiBase()}/health\ncurl ${browserApiBase()}/memories\n\ncurl -X POST ${browserApiBase()}/memories \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Terminal memory","body":"Saved through the live API","project":"General"}'`} setToast={showToast} />}
                {active === "billing" && <Billing />}
                {active === "settings" && <SettingsPage health={data.health} onClearData={clearData} busy={busyAction === "data:clear"} />}
                {active === "help" && <Help />}
              </>
            )}
          </section>
        </main>
      </div>
      {selectedApp && <ConnectModal app={selectedApp} onClose={() => setSelectedApp(null)} onConfirm={confirmConnection} busy={busyAction === `app:${selectedApp.id}`} setToast={showToast} />}
      {showAddMemory && <AddMemoryModal onClose={() => setShowAddMemory(false)} onSave={saveMemory} saving={busyAction === "memory:create"} />}
    </div>
  );
}

function Sidebar({ active, setActive, mobileOpen, setMobileOpen }) {
  const topRoutes = routes.filter((route) => ["home", "connect", "install", "help"].includes(route.id));
  const platformRoutes = routes.filter((route) => ["memories", "agents", "projects", "api", "mcp", "cli", "billing"].includes(route.id));
  const content = (
    <aside className="sidebar">
      <div className="brand"><div className="logo">M</div><b>Memfy</b><span>LOCAL</span><button onClick={() => setMobileOpen(false)} className="close mobile-only" aria-label="Close navigation"><X size={18} /></button></div>
      <div className="side-scroll">
        <button onClick={() => setActive("connect")} className="side-search" aria-label="Search apps"><Search size={16} />Search <small>Ctrl+K</small></button>
        <nav aria-label="Main navigation">{topRoutes.map((route) => <NavItem key={route.id} route={route} active={active} setActive={setActive} />)}</nav>
        <hr />
        <nav aria-label="Platform navigation">{platformRoutes.map((route) => <NavItem key={route.id} route={route} active={active} setActive={setActive} />)}</nav>
      </div>
      <div className="side-bottom">
        <NavItem route={routes.find((route) => route.id === "settings")} active={active} setActive={setActive} />
        <button onClick={() => setActive("settings")} className="primary-memory"><b>Persistent storage</b><span>SQLite via the Memfy API</span></button>
        <div className="account"><div aria-hidden="true">M</div><p>Local workspace<br /><small>server-backed</small></p></div>
      </div>
    </aside>
  );
  return <>{<div className="desktop-sidebar">{content}</div>}{mobileOpen && <div className="mobile-drawer"><button className="drawer-bg" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />{content}</div>}</>;
}

function NavItem({ route, active, setActive }) {
  if (!route) return null;
  const Icon = route.icon;
  return <button onClick={() => setActive(route.id)} className={`nav-item ${active === route.id ? "active" : ""}`} aria-current={active === route.id ? "page" : undefined}><Icon size={16} />{route.label}</button>;
}

function Connect({ apps, appFilter, setAppFilter, onConnect }) {
  return (
    <div>
      <div className="tabs" role="tablist" aria-label="App connections">
        <button onClick={() => setAppFilter("all")} className={appFilter === "all" ? "selected" : ""} role="tab" aria-selected={appFilter === "all"}>All</button>
        <button onClick={() => setAppFilter("connected")} className={appFilter === "connected" ? "selected" : ""} role="tab" aria-selected={appFilter === "connected"}>Connected</button>
      </div>
      <div className="apps-grid">
        {apps.map((app) => (
          <div key={app.id} className="app-row">
            <div className="app-left"><AppIcon name={app.name} /><div><b>{app.name}</b><p>{app.type}</p><small>{app.badge}</small></div></div>
            <StatusText status={app.status} onClick={() => onConnect(app)} />
          </div>
        ))}
      </div>
      {apps.length === 0 && <EmptyState title={appFilter === "connected" ? "No connected routes" : "No app routes configured"} description={appFilter === "connected" ? "Connect a configured route to see it here." : "Configure an app route in the server before it appears here."} />}
    </div>
  );
}

function AppIcon({ name }) {
  const marks = { "REST API": "API" };
  return <div className="app-icon">{marks[name] || "AI"}</div>;
}

function StatusText({ status, onClick }) {
  if (status === "connected") return <button onClick={onClick} className="connected-btn">✓ Connected</button>;
  return <button onClick={onClick} className="connect-btn">Connect</button>;
}

function InfoBox({ label, value }) {
  return <div className="info-box"><p>{label}</p><b>{value}</b></div>;
}

function ConnectModal({ app, onClose, onConfirm, busy, setToast }) {
  const connected = app.status === "connected";
  const command = getConnectionCommand(app);
  const titleId = `connect-${app.id}`;
  return (
    <ModalShell titleId={titleId} onClose={onClose}>
      <div className="modal-head">
        <div><p>CONFIGURE ROUTE</p><h2 id={titleId}>{app.name}</h2><span>{app.type}</span></div>
        <button onClick={onClose} aria-label={`Close ${app.name} connection dialog`}>Close</button>
      </div>
      <div className="modal-body">
        <div className="info-grid"><InfoBox label="Status" value={connected ? "Connected" : "Available"} /><InfoBox label="Storage" value="SQLite" /><InfoBox label="Auth" value="Not configured" /></div>
        <p className="label">Working request</p>
        <pre><code>{command}</code></pre>
        <p className="warning">Registering this route records an app connection in the local database. It does not create third-party OAuth credentials.</p>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={onClose}>Cancel</button>
          <button className="ghost-btn" onClick={() => copyText(command, setToast)}><Copy size={16} /> Copy</button>
          <button disabled={busy} className={connected ? "ghost-btn" : "primary-btn"} onClick={onConfirm}>{busy ? "Saving…" : connected ? "Disconnect route" : "Register route"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function Home({ memories, stats, health, onRefresh }) {
  const recent = memories.slice(0, 4);
  return (
    <div className="stack">
      <div className="metrics">
        <Metric title="Memory route" value="REST API" icon={ShieldCheck} />
        <Metric title="Connected routes" value={String(stats.connectionCount)} icon={Layers3} />
        <Metric title="Memory records" value={String(stats.memoryCount)} icon={Brain} />
        <Metric title="Tracked recalls" value={Number(stats.recallCount || 0).toLocaleString()} icon={Activity} />
      </div>
      <div className="two-col">
        <Panel title="Recent memories">
          {recent.length > 0 ? recent.map((memory) => <div key={memory.id} className="list-item"><span><b>{memory.title}</b><small className="list-subtext">{memory.project}</small></span><small>{formatRelativeTime(memory.updatedAt || memory.createdAt)}</small></div>) : <EmptyInline text="No memories have been saved yet." />}
        </Panel>
        <Panel title="Backend status">
          <p>The dashboard reads and writes through the Memfy API. Records are stored in SQLite on the server.</p>
          <span className={health?.ok ? "active-status" : "status-pill"}>{health?.ok ? "✓ API connected" : "API unavailable"}</span>
          <button onClick={onRefresh} className="ghost-btn refresh-btn"><RefreshCw size={15} /> Refresh</button>
        </Panel>
      </div>
      <Panel title="No demo data">
        <p>This workspace starts empty. Add a memory or register the REST route to create real records in the database.</p>
      </Panel>
    </div>
  );
}

function Metric({ title, value, icon: Icon }) {
  return <div className="metric"><div><p>{title}</p><Icon size={16} /></div><b>{value}</b></div>;
}

function Panel({ title, children }) {
  return <div className="panel"><h3>{title}</h3>{children}</div>;
}

function LoadingState() {
  return <div className="empty" role="status"><b>Loading Memfy data…</b><p>Connecting to the local API.</p></div>;
}

function ErrorState({ message, onRetry }) {
  return <div className="empty error-state" role="alert"><AlertCircle size={22} /><b>Memfy API unavailable</b><p>{message}</p><button className="primary-btn" onClick={onRetry}><RefreshCw size={16} /> Retry</button></div>;
}

function EmptyState({ title, description }) {
  return <div className="empty"><b>{title}</b><p>{description}</p></div>;
}

function EmptyInline({ text }) {
  return <p className="empty-inline">{text}</p>;
}

function Memories({ memories, onAdd, onRecall, onDelete, busyAction }) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = memories.filter((memory) => `${memory.title} ${memory.body} ${memory.project} ${memory.source}`.toLowerCase().includes(normalizedSearch));

  return (
    <div className="stack">
      <div className="toolbar"><input type="search" aria-label="Search memories" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search memories..." /><button onClick={onAdd} className="primary-btn"><Plus size={16} /> Add Memory</button></div>
      {filtered.length > 0 ? filtered.map((memory) => {
        const busy = busyAction === `memory:${memory.id}`;
        return <div key={memory.id} className="memory-card"><div><h3>{memory.title}</h3><p>{memory.body}</p><div className="chips"><span>{memory.project}</span><span>{memory.source}</span><span>{memory.recalls} recalls</span><span>{formatDateTime(memory.updatedAt || memory.createdAt)}</span></div></div><div className="memory-side"><b>{memory.importance}</b><div className="memory-actions"><button className="ghost-btn" disabled={busy} onClick={() => onRecall(memory)}><Activity size={15} /> Recall</button><button className="icon-btn danger-btn" disabled={busy} onClick={() => onDelete(memory)} aria-label={`Delete ${memory.title}`}><Trash2 size={16} /></button></div></div></div>;
      }) : <EmptyState title={memories.length === 0 ? "No memories yet" : "No memories match this search"} description={memories.length === 0 ? "Create the first record to verify the live database workflow." : "Try a different title, project, or content search."} />}
    </div>
  );
}

function AddMemoryModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ title: "", body: "", project: "" });
  const canSave = form.title.trim() && form.body.trim() && !saving;
  const titleId = "add-memory-title";
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <ModalShell titleId={titleId} onClose={onClose} className="small">
      <div className="modal-head"><h2 id={titleId}>Add Memory</h2><button onClick={onClose} aria-label="Close add memory dialog"><X size={18} /></button></div>
      <div className="form-stack"><label htmlFor="memory-title">Title</label><input id="memory-title" data-autofocus value={form.title} onChange={update("title")} placeholder="Memory title" /><label htmlFor="memory-body">Content</label><textarea id="memory-body" value={form.body} onChange={update("body")} placeholder="Memory content" /><label htmlFor="memory-project">Project (optional)</label><input id="memory-project" value={form.project} onChange={update("project")} placeholder="General" /></div>
      <div className="modal-actions"><button className="ghost-btn" onClick={onClose}>Cancel</button><button disabled={!canSave} className="primary-btn" onClick={() => onSave({ title: form.title.trim(), body: form.body.trim(), project: form.project.trim() })}>{saving ? "Saving…" : "Save Memory"}</button></div>
    </ModalShell>
  );
}

function Agents({ items }) {
  return <CardGrid items={items} kind="agent" emptyTitle="No agents registered" emptyDescription="Register a configured app route to show a real client here." />;
}

function Projects({ items }) {
  return <CardGrid items={items} kind="project" emptyTitle="No projects yet" emptyDescription="Projects appear automatically when a memory is saved with a project name." />;
}

function CardGrid({ items, kind, emptyTitle, emptyDescription }) {
  if (items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <div className="card-grid">{items.map((item) => <div key={item.id || item.name} className="simple-card"><div className="card-icon">{kind === "agent" ? <Layers3 size={20} /> : <Database size={20} />}</div><h3>{item.name}</h3><p>{kind === "agent" ? `${item.route} · ${formatDateTime(item.connectedAt)}` : `${item.memories} memories · ${item.recalls} recalls`}</p><span className={item.status === "Connected" ? "active-status" : "status-pill"}>{item.status || "Active"}</span></div>)}</div>;
}

function Install({ setToast }) {
  const base = browserApiBase();
  const health = `curl ${base}/health`;
  const create = getConnectionCommand({ id: "rest-api", name: "REST API" });
  return (
    <div className="install"><h1>Use Memfy</h1><div className="two-col"><Panel title="Start the backend"><p>Run these commands from the repository. The API creates its SQLite database on first start and does not seed records.</p><CopyBox label="Start API" value="npm run api" setToast={setToast} /><CopyBox label="Health check" value={health} setToast={setToast} /></Panel><Panel title="Write a real memory"><p>Use the live REST route from any agent or terminal client.</p><button onClick={() => copyText(create, setToast)} className="code-copy"><span>POST {base}/memories</span><Copy size={16} /></button><pre><code>{create}</code></pre></Panel></div><div className="install-list"><InstallRow app={{ name: "REST API", type: "Persistent HTTP memory route", id: "rest-api" }} setToast={setToast} /></div></div>
  );
}

function InstallRow({ app, setToast }) {
  return <div className="install-row"><div><b>API</b><span>{app.name}<small>{app.type}</small></span></div><button onClick={() => copyText(getConnectionCommand(app), setToast)}>Copy setup ↗</button></div>;
}

function CopyBox({ label, value, setToast }) {
  return <button onClick={() => copyText(value, setToast)} className="copy-box"><span><small>{label}</small>{value}</span><Copy size={16} /></button>;
}

function DevPanel({ title, description, warning, command, setToast }) {
  return <Panel title={title}><p>{description}</p>{warning && <p className="warning">{warning}</p>}<button className="ghost-btn" onClick={() => copyText(command, setToast)}><Copy size={16} /> Copy</button><pre><code>{command}</code></pre></Panel>;
}

function Billing() {
  return <div className="price-panel"><p>Memfy — Open Source</p><h1>Open <span>source</span></h1><ul><li>No billing or paywall code is included in this repository.</li><li>Run the API locally or deploy it on infrastructure you control.</li><li>SQLite persistence is included for the working local deployment.</li><li>Third-party OAuth and hosted auth still need to be configured.</li></ul><a href="https://github.com/aiwithenoch/memfy" target="_blank" rel="noreferrer" className="primary-btn" style={{ display: "inline-flex", textDecoration: "none", marginTop: 8 }}>View on GitHub ↗</a></div>;
}

function SettingsPage({ health, onClearData, busy }) {
  const settings = [
    { name: "Storage", description: "The live API stores memories and connection records in SQLite.", status: health?.ok ? "Connected" : "Unavailable" },
    { name: "Authentication", description: "No authentication is enabled by default. Add deployment auth before making the API public.", status: "Not configured" },
    { name: "Memory route", description: "The REST API is the only configured route in this repository.", status: "Available" },
    { name: "Data retention", description: "Delete every memory and registered connection from the server database.", action: busy ? "Deleting…" : "Delete all server data" },
  ];

  return <div className="stack"><div className="card-grid">{settings.map((item) => <div key={item.name} className="simple-card"><h3>{item.name}</h3><p>{item.description}</p>{item.action ? <button className="ghost-btn danger-action" disabled={busy} onClick={onClearData}>{item.action}</button> : <span className={item.status === "Connected" ? "active-status" : "status-pill"}>{item.status}</span>}</div>)}</div></div>;
}

function Help() {
  return <div className="two-col"><Panel title="What is live"><p>The REST API, SQLite persistence, memory CRUD, recall tracking, connection records, projects, and agents are backed by the server in this repository.</p></Panel><Panel title="What still needs configuration"><p>OAuth connectors, public authentication, a hosted database, and an MCP protocol adapter are not included. The UI labels these capabilities as unavailable instead of showing sample credentials or fake activity.</p></Panel></div>;
}
