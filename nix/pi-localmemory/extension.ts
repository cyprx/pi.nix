/**
 * pi-localmemory — simple cross-session memory for pi.
 *
 * - Storage: a single SQLite file with FTS5 (uses Node's built-in `node:sqlite`).
 * - Per-project by default (scope = current project path). Set
 *   PI_MEMORY_GLOBAL=1 to default to global scope.
 * - Capture is *opt-in*: assistant text is only saved if it contains a
 *   `<remember>…</remember>` block. Example:
 *
 *     <remember kind="decision" tags="auth,oauth" scope="project">
 *     Title goes on the first line
 *     ---
 *     Body can be multi-line.
 *     </remember>
 *
 * - Env:
 *     PI_MEMORY_DB        override db path (default $XDG_DATA_HOME/pi/memory.db)
 *     PI_MEMORY_PROJECT   override detected project root
 *     PI_MEMORY_GLOBAL=1  default save/search scope to "global"
 *
 * Requires Node 24+ (stable `node:sqlite`).  On Node 22.5–23, run with
 * NODE_OPTIONS="--experimental-sqlite".
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";

// ─── sqlite loader ──────────────────────────────────────────────────────────

type SqliteDB = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid: number | bigint; changes: number };
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
  close: () => void;
};

let DatabaseSync: { new (path: string): SqliteDB } | null = null;
let sqliteLoadError: string | null = null;
try {
  // Silence Node's "SQLite is an experimental feature" warning before loading.
  const origEmit = process.emit.bind(process);
  (process as unknown as { emit: typeof process.emit }).emit = function (
    name: string | symbol,
    data?: unknown,
    ...rest: unknown[]
  ): boolean {
    if (
      name === "warning" &&
      typeof data === "object" &&
      data !== null &&
      (data as { name?: string }).name === "ExperimentalWarning" &&
      typeof (data as { message?: string }).message === "string" &&
      /SQLite/i.test((data as { message: string }).message)
    ) {
      return false;
    }
    return origEmit(name as never, data as never, ...(rest as never[]));
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ DatabaseSync } = require("node:sqlite") as { DatabaseSync: { new (p: string): SqliteDB } });
} catch (err) {
  sqliteLoadError =
    (err as Error).message +
    " — pi-localmemory needs Node 24+ (stable node:sqlite) or " +
    "NODE_OPTIONS=--experimental-sqlite on Node 22.5–23.";
}

// ─── paths & project detection ──────────────────────────────────────────────

function defaultDbPath(): string {
  if (process.env.PI_MEMORY_DB) return process.env.PI_MEMORY_DB;
  const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdg, "pi", "memory.db");
}

function detectProject(cwd: string): string {
  if (process.env.PI_MEMORY_PROJECT) return process.env.PI_MEMORY_PROJECT;
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (root) return root;
  } catch {
    /* not a git repo */
  }
  return cwd;
}

const GLOBAL_SCOPE = "*";
const defaultScope = (): "project" | "global" =>
  process.env.PI_MEMORY_GLOBAL === "1" ? "global" : "project";

// ─── db open / schema ───────────────────────────────────────────────────────

function openDb(dbPath: string): SqliteDB {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync!(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS memories (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      ts      INTEGER NOT NULL,
      project TEXT    NOT NULL,
      kind    TEXT    NOT NULL DEFAULT 'note',
      title   TEXT    NOT NULL,
      body    TEXT    NOT NULL DEFAULT '',
      tags    TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      title, body, tags,
      content='memories', content_rowid='id', tokenize='porter unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, title, body, tags)
      VALUES (new.id, new.title, new.body, new.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, title, body, tags)
      VALUES ('delete', old.id, old.title, old.body, old.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, title, body, tags)
      VALUES ('delete', old.id, old.title, old.body, old.tags);
      INSERT INTO memories_fts(rowid, title, body, tags)
      VALUES (new.id, new.title, new.body, new.tags);
    END;
  `);
  return db;
}

// ─── helpers ────────────────────────────────────────────────────────────────

type MemoryRow = {
  id: number;
  ts: number;
  project: string;
  kind: string;
  title: string;
  body: string;
  tags: string;
};

type TextBlock = { type?: string; text?: string };
type AssistantMessage = { role?: string; content?: unknown };

function getText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [] as string[];
      const block = part as TextBlock;
      if (block.type === "text" && typeof block.text === "string") return [block.text];
      return [] as string[];
    })
    .join("\n")
    .trim();
}

function getLastAssistantText(messages: unknown[]): string {
  for (const msg of [...messages].reverse()) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as AssistantMessage;
    if (m.role !== "assistant") continue;
    const text = getText(m.content);
    if (text) return text;
  }
  return "";
}

/** Convert free-text query into a safe FTS5 MATCH expression (prefix-AND). */
function toFtsQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (!tokens.length) return "";
  return tokens.map((t) => `${t}*`).join(" AND ");
}

function formatRows(rows: MemoryRow[]): string {
  if (!rows.length) return "No relevant memories found.";
  return rows
    .map((r) => {
      const when = new Date(r.ts).toISOString().slice(0, 10);
      const scope = r.project === GLOBAL_SCOPE ? "global" : path.basename(r.project);
      const tags = r.tags ? ` [${r.tags}]` : "";
      const body = r.body ? `\n  ${r.body.replace(/\n/g, "\n  ")}` : "";
      return `#${r.id} ${when} (${r.kind}, ${scope})${tags} ${r.title}${body}`;
    })
    .join("\n");
}

// ─── <remember> block parser ────────────────────────────────────────────────

type ParsedRemember = {
  kind: string;
  tags: string;
  scope: "project" | "global";
  title: string;
  body: string;
};

const REMEMBER_RE = /<remember\b([^>]*)>([\s\S]*?)<\/remember>/gi;

function parseAttrs(attrs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of attrs.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) {
    out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

function parseRememberBlocks(text: string): ParsedRemember[] {
  const blocks: ParsedRemember[] = [];
  for (const m of text.matchAll(REMEMBER_RE)) {
    const attrs = parseAttrs(m[1] || "");
    const raw = m[2].trim();
    if (!raw) continue;

    let title: string;
    let body: string;
    if (raw.includes("\n---\n")) {
      const idx = raw.indexOf("\n---\n");
      title = raw.slice(0, idx).trim();
      body = raw.slice(idx + 5).trim();
    } else {
      const nl = raw.indexOf("\n");
      title = (nl === -1 ? raw : raw.slice(0, nl)).trim();
      body = nl === -1 ? "" : raw.slice(nl + 1).trim();
    }
    if (!title) continue;

    const scope = attrs.scope === "global" ? "global" : "project";
    blocks.push({
      kind: attrs.kind || "note",
      tags: attrs.tags || "",
      scope,
      title: title.slice(0, 500),
      body: body.slice(0, 8000),
    });
  }
  return blocks;
}

// ─── extension ──────────────────────────────────────────────────────────────

const TOOL_GUIDANCE = [
  "Local memory (pi-localmemory) is available for cross-session recall.",
  "Use memory_search to look up prior decisions, conventions, bugs, and preferences.",
  "Use memory_save (or wrap durable facts in <remember>…</remember> in your reply) to persist them.",
  "By default memories are scoped to the current project; pass scope:\"global\" for cross-project notes.",
].join(" ");

export default function localmemoryExtension(pi: ExtensionAPI) {
  const dbPath = defaultDbPath();
  let db: SqliteDB | null = null;
  let currentProject = detectProject(process.cwd());
  let lastPrompt = "";

  function ensureDb(): SqliteDB | null {
    if (db) return db;
    if (!DatabaseSync) return null;
    try {
      db = openDb(dbPath);
      return db;
    } catch (err) {
      sqliteLoadError = (err as Error).message;
      return null;
    }
  }

  function scopeProject(scope: "project" | "global"): string {
    return scope === "global" ? GLOBAL_SCOPE : currentProject;
  }

  function search(query: string, limit: number, scope: "project" | "global" | "all"): MemoryRow[] {
    const d = ensureDb();
    if (!d) return [];
    const fts = toFtsQuery(query);
    const projectFilter =
      scope === "all"
        ? ""
        : scope === "global"
          ? "AND m.project = ?"
          : "AND (m.project = ? OR m.project = '*')";
    const params: unknown[] = [];
    let sql: string;
    if (fts) {
      sql = `
        SELECT m.id, m.ts, m.project, m.kind, m.title, m.body, m.tags
        FROM memories_fts f
        JOIN memories m ON m.id = f.rowid
        WHERE memories_fts MATCH ? ${projectFilter}
        ORDER BY bm25(memories_fts), m.ts DESC
        LIMIT ?
      `;
      params.push(fts);
    } else {
      // Fallback: most-recent rows in scope
      sql = `
        SELECT id, ts, project, kind, title, body, tags
        FROM memories m
        WHERE 1=1 ${projectFilter}
        ORDER BY ts DESC
        LIMIT ?
      `;
    }
    if (scope !== "all") params.push(scope === "global" ? GLOBAL_SCOPE : currentProject);
    params.push(limit);
    return d.prepare(sql).all(...params) as MemoryRow[];
  }

  function save(args: {
    title: string;
    body?: string;
    kind?: string;
    tags?: string;
    scope?: "project" | "global";
  }): MemoryRow | null {
    const d = ensureDb();
    if (!d) return null;
    const scope = args.scope || defaultScope();
    const row = {
      ts: Date.now(),
      project: scopeProject(scope),
      kind: args.kind || "note",
      title: args.title.slice(0, 500),
      body: (args.body || "").slice(0, 8000),
      tags: args.tags || "",
    };
    const res = d
      .prepare(
        "INSERT INTO memories(ts, project, kind, title, body, tags) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(row.ts, row.project, row.kind, row.title, row.body, row.tags);
    return { id: Number(res.lastInsertRowid), ...row };
  }

  // ── tools ────────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "memory_health",
    label: "Memory Health",
    description: "Report whether the local SQLite memory store is reachable and how many entries it contains.",
    parameters: Type.Object({}),
    async execute() {
      if (sqliteLoadError && !DatabaseSync) {
        return {
          content: [{ type: "text", text: `pi-localmemory unavailable: ${sqliteLoadError}` }],
          details: { ok: false, error: sqliteLoadError },
        };
      }
      const d = ensureDb();
      if (!d) {
        return {
          content: [{ type: "text", text: `pi-localmemory failed to open ${dbPath}: ${sqliteLoadError ?? "unknown"}` }],
          details: { ok: false },
        };
      }
      const total = (d.prepare("SELECT COUNT(*) AS n FROM memories").get() as { n: number }).n;
      const inProject = (d
        .prepare("SELECT COUNT(*) AS n FROM memories WHERE project = ?")
        .get(currentProject) as { n: number }).n;
      const globalN = (d
        .prepare("SELECT COUNT(*) AS n FROM memories WHERE project = ?")
        .get(GLOBAL_SCOPE) as { n: number }).n;
      return {
        content: [
          {
            type: "text",
            text:
              `pi-localmemory ok\n  db: ${dbPath}\n  project: ${currentProject}\n` +
              `  entries: ${total} total · ${inProject} this project · ${globalN} global`,
          },
        ],
        details: { ok: true, dbPath, project: currentProject, total, inProject, global: globalN },
      };
    },
  });

  pi.registerTool({
    name: "memory_search",
    label: "Memory Search",
    description:
      "Search local cross-session memory for prior decisions, conventions, bugs, and preferences. Project-scoped by default.",
    parameters: Type.Object({
      query: Type.String({ description: "Free-text query (FTS5 with prefix matching)" }),
      limit: Type.Optional(
        Type.Integer({ minimum: 1, maximum: 20, default: 5, description: "Maximum results" }),
      ),
      scope: Type.Optional(
        Type.Union([Type.Literal("project"), Type.Literal("global"), Type.Literal("all")], {
          description:
            "project = current project + global memories (default), global = only global, all = ignore project filter",
          default: "project",
        }),
      ),
    }),
    async execute(_id, params) {
      const limit = params.limit ?? 5;
      const scope = (params.scope ?? "project") as "project" | "global" | "all";
      const rows = search(params.query, limit, scope);
      return {
        content: [{ type: "text", text: formatRows(rows) }],
        details: { query: params.query, scope, count: rows.length, results: rows },
      };
    },
  });

  pi.registerTool({
    name: "memory_save",
    label: "Memory Save",
    description:
      "Save a durable note (decision, convention, workflow, preference, bug fix) to local memory. Scoped to the current project unless scope=\"global\".",
    parameters: Type.Object({
      title: Type.String({ description: "Short title / headline" }),
      body: Type.Optional(Type.String({ description: "Longer explanation" })),
      kind: Type.Optional(
        Type.String({ description: "decision | convention | bug | pref | note (default: note)" }),
      ),
      tags: Type.Optional(Type.String({ description: "Comma-separated tags" })),
      scope: Type.Optional(
        Type.Union([Type.Literal("project"), Type.Literal("global")], {
          description: "project (default) or global",
        }),
      ),
    }),
    async execute(_id, params) {
      const row = save({
        title: params.title,
        body: params.body,
        kind: params.kind,
        tags: params.tags,
        scope: params.scope,
      });
      if (!row) {
        return {
          content: [{ type: "text", text: "Failed to save memory (db unavailable)." }],
          details: { ok: false },
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Saved memory #${row.id} (${row.kind}, ${row.project === GLOBAL_SCOPE ? "global" : "project"}): ${row.title}`,
          },
        ],
        details: { ok: true, row },
      };
    },
  });

  pi.registerTool({
    name: "memory_forget",
    label: "Memory Forget",
    description: "Delete a memory by id.",
    parameters: Type.Object({
      id: Type.Integer({ description: "Memory id (as shown by memory_search)" }),
    }),
    async execute(_id, params) {
      const d = ensureDb();
      if (!d) {
        return {
          content: [{ type: "text", text: "db unavailable" }],
          details: { ok: false },
        };
      }
      const res = d.prepare("DELETE FROM memories WHERE id = ?").run(params.id);
      const ok = res.changes > 0;
      return {
        content: [{ type: "text", text: ok ? `Forgot memory #${params.id}` : `No memory #${params.id}` }],
        details: { ok, changes: res.changes },
      };
    },
  });

  // ── commands ─────────────────────────────────────────────────────────────

  pi.registerCommand("localmemory-status", {
    description: "Show pi-localmemory status (path, project, entry counts)",
    handler: async (_args, ctx) => {
      if (!DatabaseSync) {
        ctx.ui.notify(`pi-localmemory unavailable: ${sqliteLoadError}`, "error");
        return;
      }
      const d = ensureDb();
      if (!d) {
        ctx.ui.notify(`pi-localmemory: failed to open ${dbPath}`, "error");
        return;
      }
      const total = (d.prepare("SELECT COUNT(*) AS n FROM memories").get() as { n: number }).n;
      ctx.ui.notify(`pi-localmemory: ${total} entries · project ${currentProject}`, "info");
    },
  });

  // ── lifecycle hooks ──────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    currentProject = detectProject(process.cwd());
    if (!DatabaseSync) {
      ctx.ui.setStatus("localmemory", "🧠 mem off");
      ctx.ui.notify(`pi-localmemory disabled: ${sqliteLoadError}`, "warning");
      return;
    }
    const d = ensureDb();
    ctx.ui.setStatus("localmemory", d ? "🧠 mem" : "🧠 mem off");
  });

  pi.on("before_agent_start", async (event) => {
    currentProject = detectProject(event.systemPromptOptions.cwd || process.cwd());
    lastPrompt = event.prompt?.trim() || "";
    if (!lastPrompt) return;

    const rows = search(lastPrompt, 5, "project");
    const recallBlock = rows.length
      ? ["Relevant local memory:", formatRows(rows)].join("\n")
      : "";

    return {
      systemPrompt: [event.systemPrompt, TOOL_GUIDANCE, recallBlock].filter(Boolean).join("\n\n"),
    };
  });

  pi.on("agent_end", async (event) => {
    if (!ensureDb()) return;
    const assistantText = getLastAssistantText(event.messages as unknown[]);
    if (!assistantText) return;
    const blocks = parseRememberBlocks(assistantText);
    for (const b of blocks) {
      save({ title: b.title, body: b.body, kind: b.kind, tags: b.tags, scope: b.scope });
    }
  });
}
