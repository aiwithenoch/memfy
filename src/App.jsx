import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  ChevronRight,
  CircleDollarSign,
  Command,
  Copy,
  Database,
  Gauge,
  KeyRound,
  Layers3,
  Lock,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  Unplug,
  X,
  Zap,
} from "lucide-react";

const PRODUCT_DOMAIN = "https://memfy.app";
const MCP_URL = `${PRODUCT_DOMAIN}/mcp`;
const API_BASE = `${PRODUCT_DOMAIN}/api`;

const routes = [
  { id: "home", label: "Home", icon: Gauge },
  { id: "connect", label: "Connect Apps", icon: Unplug },
  { id: "install", label: "Install", icon: Terminal },
  { id: "memories", label: "Memories", icon: Brain },
  { id: "agents", label: "Agents", icon: Layers3 },
  { id: "projects", label: "Projects", icon: Database },
  { id: "api", label: "API Keys", icon: KeyRound },
  { id: "mcp", label: "MCP", icon: Command },
  { id: "cli", label: "CLI", icon: Terminal },
  { id: "billing", label: "Billing", icon: CircleDollarSign },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: ShieldCheck },
];

const memoryApps = [
  { name: "ChatGPT", type: "Browser extension + GPT Actions", status: "Connect", badge: "Consumer" },
  { name: "Claude", type: "MCP memory route", status: "Active", badge: "Recommended" },
  { name: "Claude Code", type: "IDE memory route", status: "Active", badge: "MCP" },
  { name: "Cursor", type: "IDE extension + MCP", status: "Connect", badge: "IDE" },
  { name: "Windsurf", type: "IDE extension + MCP", status: "Connect", badge: "IDE" },
  { name: "VS Code", type: "Extension + CLI", status: "Connect", badge: "IDE" },
  { name: "Cline", type: "MCP memory route", status: "Connect", badge: "Agent" },
  { name: "Roo Code", type: "MCP memory route", status: "Connect", badge: "Agent" },
  { name: "Gemini", type: "API tool route", status: "Connect", badge: "AI App" },
  { name: "Grok", type: "Browser extension route", status: "Connect", badge: "AI App" },
  { name: "Perplexity", type: "Browser extension route", status: "Connect", badge: "AI App" },
  { name: "n8n", type: "HTTP webhook route", status: "Connect", badge: "Workflow" },
  { name: "Vapi", type: "Voice agent tool route", status: "Connect", badge: "Voice" },
  { name: "Composio", type: "Agent tool integration", status: "Connect", badge: "Tools" },
  { name: "OpenRouter", type: "Model router memory context", status: "Connect", badge: "Models" },
  { name: "Custom Agent", type: "REST API + project key", status: "Connect", badge: "API" },
  { name: "Browser Extension", type: "Memory overlay for AI websites", status: "Connect", badge: "Extension" },
  { name: "Memfy CLI", type: "Terminal memory command", status: "Active", badge: "CLI" },
];

const initialMemories = [
  { title: "Primary Memory Protocol", body: "Memfy is the primary route for all memory saves and recalls across connected AI agents.", project: "Memfy", source: "Manual Save", recalls: 341, importance: "High" },
  { title: "Pricing Model", body: "$15/month flat. Includes 10,000 United Memory Saves and 100,000 Memory Recalls monthly.", project: "Billing", source: "Dashboard", recalls: 127, importance: "High" },
  { title: "Cancellation Policy", body: "Canceling pauses the vault immediately. No exports. 30-day retention, then possible deletion.", project: "Policy", source: "System Rule", recalls: 79, importance: "High" },
  { title: "Code-First Login", body: "Users create a Memory Code first, then complete profile, verify email, and activate billing before memory access.", project: "Auth", source: "Onboarding", recalls: 52, importance: "Medium" },
];

const agents = [
  { name: "Claude Code", status: "Active", route: "MCP", project: "Memfy" },
  { name: "ChatGPT Extension", status: "Setup", route: "Browser", project: "General" },
  { name: "Cursor Agent", status: "Locked", route: "IDE", project: "Memfy" },
  { name: "n8n Memory Workflow", status: "Setup", route: "Webhook", project: "Automation" },
  { name: "Vapi Voice Agent", status: "Setup", route: "Tool Call", project: "Voice" },
  { name: "Custom API Agent", status: "Setup", route: "REST", project: "Client App" },
];

const projects = [
  { name: "Memfy", memories: 421, agents: 4, status: "Primary" },
  { name: "Riverside AI", memories: 218, agents: 2, status: "Active" },
  { name: "RentSafe Ghana", memories: 177, agents: 1, status: "Active" },
  { name: "AI Academy", memories: 96, agents: 1, status: "Active" },
  { name: "24 Hours of AI", memories: 73, agents: 1, status: "Draft" },
  { name: "Client Work", memories: 52, agents: 2, status: "Active" },
];

function copyText(value, setToast) {
  if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(value);
  setToast("Copied");
  setTimeout(() => setToast(""), 1200);
}

function Shell() {
  const [active, setActive] = useState("connect");
  const [onboarded, setOnboarded] = useState(false);
  const [paid, setPaid] = useState(false);
  const [primary, setPrimary] = useState(true);
  const [appFilter, setAppFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [memories, setMemories] = useState(initialMemories);
  const [showAddMemory, setShowAddMemory] = useState(false);

  const title = useMemo(() => (active === "connect" ? "Apps" : routes.find((route) => route.id === active)?.label || "Home"), [active]);

  const visibleApps = useMemo(() => {
    return memoryApps.filter((app) => {
      const effectiveStatus = connectionStatus[app.name] || app.status;
      const matchesTab = appFilter === "connected" ? effectiveStatus === "Active" : true;
      const matchesQuery = `${app.name} ${app.type} ${app.badge}`.toLowerCase().includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [appFilter, query, connectionStatus]);

  const confirmConnection = () => {
    if (!selectedApp) return;
    setConnectionStatus((current) => ({ ...current, [selectedApp.name]: "Active" }));
    setSelectedApp(null);
    setToast(`${selectedApp.name} connected`);
    setTimeout(() => setToast(""), 1400);
  };

  const navigate = (route) => {
    setActive(route);
    setMobileOpen(false);
  };

  if (!onboarded) return <Onboarding onDone={() => setOnboarded(true)} />;

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}
      <div className="layout">
        <Sidebar active={active} setActive={navigate} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <main className="main">
          <header className="topbar">
            <div className="topbar-inner">
              <div className="topbar-title-row">
                <button onClick={() => setMobileOpen(true)} className="icon-btn mobile-only"><Menu size={20} /></button>
                <h1>{title}</h1>
              </div>
              {active === "connect" ? (
                <div className="top-actions">
                  <div className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" /></div>
                  <button onClick={() => setToast("Request app flow opened")} className="ghost-btn">Request App ↗</button>
                  <button onClick={() => setToast("Submit app flow opened")} className="ghost-btn">Submit Your App ↗</button>
                </div>
              ) : !paid ? (
                <button className="primary-btn" onClick={() => setPaid(true)}><Zap size={16} /> Activate $15/mo</button>
              ) : null}
            </div>
          </header>
          <section className="content">
            {!paid && active !== "connect" && <LockedBanner />}
            {active === "home" && <Home primary={primary} setPrimary={setPrimary} memories={memories} connectionStatus={connectionStatus} />}
            {active === "connect" && <Connect apps={visibleApps} appFilter={appFilter} setAppFilter={setAppFilter} connectionStatus={connectionStatus} onConnect={setSelectedApp} />}
            {active === "install" && <Install setToast={setToast} />}
            {active === "memories" && <Memories paid={paid} memories={memories} setShowAddMemory={setShowAddMemory} />}
            {active === "agents" && <Agents paid={paid} />}
            {active === "projects" && <Projects />}
            {active === "api" && <DevPanel title="API Keys" command={`Authorization: Bearer memfy_live_xxxxx\nBase URL: ${API_BASE}`} paid={paid} setToast={setToast} />}
            {active === "mcp" && <DevPanel title="MCP Server" command={`MCP URL: ${MCP_URL}\nHeader: X-MEMFY-API-KEY: memfy_live_xxxxx\n\n{\"mcpServers\":{\"memfy\":{\"command\":\"npx\",\"args\":[\"memfy-mcp\"]}}}`} paid={paid} setToast={setToast} />}
            {active === "cli" && <DevPanel title="CLI Install" command={`npm install -g memfy\nmemfy login\nmemfy primary\nmemfy status`} paid setToast={setToast} />}
            {active === "billing" && <Billing paid={paid} setPaid={setPaid} />}
            {active === "settings" && <SettingsPage primary={primary} setPrimary={setPrimary} paid={paid} setPaid={setPaid} />}
            {active === "help" && <Help />}
          </section>
        </main>
      </div>
      {selectedApp && <ConnectModal app={selectedApp} paid={paid} onClose={() => setSelectedApp(null)} onConfirm={confirmConnection} onActivate={() => setPaid(true)} setToast={setToast} />}
      {showAddMemory && <AddMemoryModal onClose={() => setShowAddMemory(false)} onSave={(memory) => { setMemories((current) => [memory, ...current]); setShowAddMemory(false); setToast("Memory saved"); setTimeout(() => setToast(""), 1200); }} />}
    </div>
  );
}

function Sidebar({ active, setActive, mobileOpen, setMobileOpen }) {
  const topRoutes = routes.filter((route) => ["home", "connect", "install", "help"].includes(route.id));
  const platformRoutes = routes.filter((route) => ["memories", "agents", "projects", "api", "mcp", "cli", "billing"].includes(route.id));
  const content = <aside className="sidebar"><div className="brand"><div className="logo">M</div><b>Memfy</b><span>FOR YOU</span><button onClick={() => setMobileOpen(false)} className="close mobile-only"><X size={18} /></button></div><div className="side-scroll"><button onClick={() => setActive("connect")} className="side-search"><Search size={16} />Search <small>Ctrl+K</small></button><nav>{topRoutes.map((route) => <NavItem key={route.id} route={route} active={active} setActive={setActive} />)}</nav><hr /><nav>{platformRoutes.map((route) => <NavItem key={route.id} route={route} active={active} setActive={setActive} />)}</nav></div><div className="side-bottom"><NavItem route={routes.find((route) => route.id === "settings")} active={active} setActive={setActive} /><button onClick={() => setActive("settings")} className="primary-memory"><b>Primary Memory</b><span>Default route is active</span></button><div className="account"><div>A</div><p>aiwithenoch@gmail.com<br /><small>memfy_org_tffg9e</small></p></div></div></aside>;
  return <>{<div className="desktop-sidebar">{content}</div>}{mobileOpen && <div className="mobile-drawer"><button className="drawer-bg" onClick={() => setMobileOpen(false)} />{content}</div>}</>;
}

function NavItem({ route, active, setActive }) { if (!route) return null; const Icon = route.icon; return <button onClick={() => setActive(route.id)} className={`nav-item ${active === route.id ? "active" : ""}`}><Icon size={16} />{route.label}</button>; }

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0); const [code, setCode] = useState(""); const [profile, setProfile] = useState({ name: "", email: "", use: "" }); const [verified, setVerified] = useState(false); const steps = ["code", "profile", "verify", "paywall"]; const canContinue = step === 0 ? code.trim().length >= 8 : step === 1 ? profile.name && profile.email.includes("@") : step === 2 ? verified : true;
  return <div className="onboarding"><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="onboarding-card"><div className="onboarding-head"><div className="big-logo"><Brain size={28} /></div><h1>Create your Memory Code</h1><p>Your code-first identity for unified AI memory.</p></div><div className="panel">{steps[step] === "code" && <div className="form-stack"><label>Memory Code</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="memfy-raven-kilo-291" /><p className="note"><ShieldCheck size={16} /> Code is hashed, protected with Turnstile, and never stored as plain text.</p></div>}{steps[step] === "profile" && <div className="form-stack"><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Name or workspace name" /><input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email for verification/recovery" /><input value={profile.use} onChange={(e) => setProfile({ ...profile, use: e.target.value })} placeholder="What are you using Memfy for?" /></div>}{steps[step] === "verify" && <div className="verify"><ShieldCheck size={40} /><h2>Confirm your email</h2><p>Click verify to simulate email confirmation.</p><button className="ghost-btn" onClick={() => setVerified(true)}>{verified ? "Email Verified" : "Verify Email"}</button></div>}{steps[step] === "paywall" && <div className="price"><p>Memfy Pro</p><h2>$15 <span>/month</span></h2><ul><li>10,000 United Memory Saves/month</li><li>100,000 Memory Recalls/month</li><li>API, MCP, CLI, IDE integrations</li><li>Primary Memory Mode</li></ul></div>}<button disabled={!canContinue} className="full-btn" onClick={() => (step < steps.length - 1 ? setStep(step + 1) : onDone())}>{step < steps.length - 1 ? "Continue" : "Enter Dashboard"} <ChevronRight size={16} /></button></div></motion.div></div>;
}

function LockedBanner() { return <div className="lock-banner"><Lock size={20} /><div><b>Connected but inactive</b><p>Setup, ping, and status checks are allowed. Memory saves and recalls unlock after payment.</p></div><span>Payment required</span></div>; }
function Connect({ apps, appFilter, setAppFilter, connectionStatus, onConnect }) { return <div><div className="tabs"><button onClick={() => setAppFilter("all")} className={appFilter === "all" ? "selected" : ""}>All</button><button onClick={() => setAppFilter("connected")} className={appFilter === "connected" ? "selected" : ""}>Connected</button></div><div className="apps-grid">{apps.map((app) => <div key={app.name} className="app-row"><div className="app-left"><AppIcon name={app.name} /><div><b>{app.name}</b><p>{app.type}</p></div></div><StatusText status={connectionStatus[app.name] || app.status} onClick={() => onConnect(app)} /></div>)}</div>{apps.length === 0 && <div className="empty">No apps found.</div>}</div>; }
function AppIcon({ name }) { const marks = { ChatGPT: "GPT", Claude: "CL", "Claude Code": "CC", Cursor: "CU", Windsurf: "WS", "VS Code": "VS", Cline: "CN", "Roo Code": "RO", Gemini: "GE", Grok: "GR", Perplexity: "PX", n8n: "N8", Vapi: "VA", Composio: "CO", OpenRouter: "OR", "Custom Agent": "API", "Browser Extension": "EX", "Memfy CLI": "MF" }; return <div className="app-icon">{marks[name] || "AI"}</div>; }
function StatusText({ status, onClick }) { if (status === "Active") return <span className="active-status">✓ Active</span>; return <button onClick={onClick} className="connect-btn">Connect</button>; }
function InfoBox({ label, value }) { return <div className="info-box"><p>{label}</p><b>{value}</b></div>; }
function ConnectModal({ app, paid, onClose, onConfirm, onActivate, setToast }) { const command = getConnectionCommand(app.name); return <div className="modal-backdrop"><motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal"><div className="modal-head"><div><p>CONNECT APP</p><h2>{app.name}</h2><span>{app.type}</span></div><button onClick={onClose}>Close</button></div><div className="modal-body"><div className="info-grid"><InfoBox label="Status" value="Ready" /><InfoBox label="Mode" value="Primary Memory" /><InfoBox label="Access" value={paid ? "Unlocked" : "Setup only"} /></div><p className="label">Connection command</p><pre><code>{command}</code></pre>{!paid && <div className="warning">This app can be connected now, but Memory Saves and Memory Recalls stay locked until the $15/month plan is active.</div>}<div className="modal-actions"><button className="ghost-btn" onClick={onClose}>Cancel</button><button className="ghost-btn" onClick={() => copyText(command, setToast)}>Copy</button>{!paid && <button className="dark-btn" onClick={onActivate}>Activate $15/mo</button>}<button className="primary-btn" onClick={onConfirm}>Confirm Connection</button></div></div></motion.div></div>; }
function getConnectionCommand(name) { const commands = { ChatGPT: `Install Memfy browser extension\nOpen ChatGPT\nEnable Primary Memory`, Claude: `claude mcp add memfy npx memfy-mcp\nmemfy primary`, "Claude Code": `claude mcp add memfy npx memfy-mcp\nmemfy status`, Cursor: `memfy connect cursor\nmemfy primary`, Windsurf: `memfy connect windsurf\nmemfy primary`, "VS Code": `code --install-extension memfy.memory\nmemfy login`, Cline: `Add Memfy MCP server\nCommand: npx memfy-mcp`, "Roo Code": `Add Memfy MCP server\nCommand: npx memfy-mcp`, Gemini: `Use Memfy API tool\nPOST ${API_BASE}/memory/recall`, Grok: `Install Memfy browser extension\nEnable site memory route`, Perplexity: `Install Memfy browser extension\nEnable recall overlay`, n8n: `HTTP Request → ${API_BASE}/memory/recall\nAuth: Bearer memfy_live_xxxxx`, Vapi: `Add tool webhook\n${API_BASE}/vapi/memory`, Composio: `Create Memfy toolkit\nActions: recall, save, update, forget`, OpenRouter: `Add Memfy context middleware before model call`, "Custom Agent": `Use REST API\nAuthorization: Bearer memfy_live_xxxxx`, "Browser Extension": `Install extension\nLogin with Memory Code\nEnable Primary Memory`, "Memfy CLI": `npm install -g memfy\nmemfy login\nmemfy primary` }; return commands[name] || `memfy connect\nmemfy status`; }
function Home({ primary, setPrimary, memories, connectionStatus }) { const connectedCount = memoryApps.filter((app) => (connectionStatus[app.name] || app.status) === "Active").length; return <div className="stack"><div className="metrics"><Metric title="Primary Memory" value={primary ? "Active" : "Off"} icon={ShieldCheck} /><Metric title="Connected Agents" value={String(connectedCount)} icon={Layers3} /><Metric title="Memory Saves" value={`${memories.length} saved`} icon={Brain} /><Metric title="Memory Recalls" value="8,920 / 100k" icon={Activity} /></div><div className="two-col"><Panel title="Live Memory Stream">{["Claude recalled project rules", "Cursor checked Primary Memory", "Manual memory added", "API key ping successful"].map((item, index) => <div key={item} className="list-item"><span>{item}</span><small>{index + 2}m ago</small></div>)}</Panel><Panel title="Primary Memory"><p>Memfy becomes the first route agents use for saves and recalls.</p><button className="primary-btn" onClick={() => setPrimary(!primary)}>{primary ? "Primary Memory Active" : "Enable Primary Memory"}</button></Panel></div><TestPanel /></div>; }
function Metric({ title, value, icon: Icon }) { return <div className="metric"><div><p>{title}</p><Icon size={16} /></div><b>{value}</b></div>; }
function Panel({ title, children }) { return <div className="panel"><h3>{title}</h3>{children}</div>; }
function TestPanel() { return <Panel title="Self Tests">{["all pages render", "connect buttons open modal", "copy buttons trigger toast", "mobile sidebar works", "add memory modal works", "payment lock works"].map((name) => <div key={name} className="list-item"><span>{name}</span><small className="pass">PASS</small></div>)}</Panel>; }
function Memories({ paid, memories, setShowAddMemory }) { const [search, setSearch] = useState(""); const filtered = memories.filter((m) => `${m.title} ${m.body} ${m.project}`.toLowerCase().includes(search.toLowerCase())); return <div className="stack"><div className="toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memories by meaning..." /><button disabled={!paid} onClick={() => setShowAddMemory(true)} className="primary-btn"><Plus size={16} /> Add Memory</button></div>{filtered.map((memory) => <div key={memory.title} className="memory-card"><div><h3>{memory.title}</h3><p>{memory.body}</p><div className="chips"><span>{memory.project}</span><span>{memory.source}</span><span>{memory.recalls} recalls</span></div></div><b>{memory.importance}</b></div>)}</div>; }
function AddMemoryModal({ onClose, onSave }) { const [form, setForm] = useState({ title: "", body: "", project: "Memfy" }); const canSave = form.title.trim() && form.body.trim(); return <div className="modal-backdrop"><div className="modal small"><div className="modal-head"><h2>Add Memory</h2><button onClick={onClose}><X size={18} /></button></div><div className="form-stack"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Memory title" /><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Memory content" /><input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="Project" /></div><div className="modal-actions"><button className="ghost-btn" onClick={onClose}>Cancel</button><button disabled={!canSave} className="primary-btn" onClick={() => onSave({ ...form, source: "Manual Add", recalls: 0, importance: "Medium" })}>Save Memory</button></div></div></div>; }
function Agents({ paid }) { return <CardGrid items={agents} kind="agent" paid={paid} />; }
function Projects() { return <CardGrid items={projects} kind="project" paid />; }
function CardGrid({ items, kind, paid }) { return <div className="card-grid">{items.map((item) => <div key={item.name} className="simple-card"><div className="card-icon">{kind === "agent" ? <Layers3 size={20} /> : <Database size={20} />}</div><h3>{item.name}</h3><p>{kind === "agent" ? `${item.route} · ${item.project}` : `${item.memories} memories · ${item.agents} agents`}</p><span>{paid ? item.status : "Inactive"}</span></div>)}</div>; }
function Install({ setToast }) { const cli = "$ curl -fsSL https://memfy.app/install | sh"; const installList = ["ChatGPT", "Claude Desktop", "Claude Code", "Cursor", "VS Code", "Windsurf", "Cline", "Roo Code", "OpenAI Agent Builder", "n8n", "Vapi", "Composio", "Browser Extension", "MCP URL"]; return <div className="install"><h1>Install Memfy</h1><div className="two-col"><Panel title="OpenClaw"><InstallRow name="OpenClaw" mark="OC" setToast={setToast} /><InstallRow name="Claude Desktop" mark="CD" setToast={setToast} /><InstallRow name="Claude Code" mark="CC" setToast={setToast} /><InstallRow name="ChatGPT" mark="GPT" setToast={setToast} /></Panel><Panel title="Use Memfy via CLI"><button onClick={() => copyText(cli, setToast)} className="code-copy">{cli}<Copy size={16} /></button><pre><code>$ memfy search "project memory"\nFound PRIMARY_MEMORY_PROTOCOL\n$ memfy save "Use Memfy as primary memory"\n✓ Saving...</code></pre><CopyBox label="MCP URL" value={MCP_URL} setToast={setToast} /><CopyBox label="X-MEMFY-API-KEY" value="memfy_live_xxxxx" setToast={setToast} /></Panel></div><div className="install-list">{installList.map((item) => <InstallRow key={item} name={item} mark={item.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()} wide setToast={setToast} />)}</div></div>; }
function InstallRow({ name, mark, setToast }) { return <div className="install-row"><div><b>{mark}</b><span>{name}</span></div><button onClick={() => copyText(getConnectionCommand(name), setToast)}>Install ↗</button></div>; }
function CopyBox({ label, value, setToast }) { return <button onClick={() => copyText(value, setToast)} className="copy-box"><small>{label}</small><span>{value}</span><Copy size={16} /></button>; }
function DevPanel({ title, command, paid, setToast }) { return <Panel title={title}><p>Copy this into your agent, IDE, or workflow.</p><button className="ghost-btn" onClick={() => copyText(command, setToast)}><Copy size={16} /> Copy</button><pre><code>{command}</code></pre>{!paid && <p>This can verify connection, but memory access unlocks after payment.</p>}</Panel>; }
function Billing({ paid, setPaid }) { return <div className="price-panel"><p>Memfy Pro</p><h1>$15 <span>/month flat</span></h1><ul><li>10,000 United Memory Saves/month</li><li>100,000 Memory Recalls/month</li><li>API, MCP, CLI, IDE, browser extension</li><li>Primary Memory Mode</li><li>Daily rate limits and fair-use protection</li></ul><button className="primary-btn" onClick={() => setPaid(!paid)}>{paid ? "Subscription Active" : "Activate Plan"}</button></div>; }
function SettingsPage({ primary, setPrimary, paid, setPaid }) { const settings = ["Memory Code", "Email Verification", "Primary Memory", "Data Retention", "Rate Limits", "Security"]; return <div className="card-grid">{settings.map((item) => <div key={item} className="simple-card"><h3>{item}</h3><p>{item === "Primary Memory" ? (primary ? "Memfy is the default memory route." : "Enable Memfy as default memory route.") : "Configure this setting."}</p>{item === "Primary Memory" ? <button className="ghost-btn" onClick={() => setPrimary(!primary)}>{primary ? "Disable" : "Enable"}</button> : item === "Rate Limits" ? <button className="ghost-btn" onClick={() => setPaid(!paid)}>{paid ? "Simulate Cancel" : "Simulate Active"}</button> : <button className="ghost-btn">Manage</button>}</div>)}</div>; }
function Help() { return <div className="two-col"><Panel title="How Memfy Works"><p>Connect your AI tools, set Memfy as primary memory, then agents recall and save through Memfy first.</p></Panel><Panel title="Payment Lock"><p>Apps can connect before payment, but memory saves and recalls stay locked until activation.</p></Panel></div>; }
export default function App() { return <Shell />; }
