# Pi Coding Agent with GitHub MCP + Web Search + Local Memory — Nix Flake

A Nix flake that packages [pi](https://pi.dev) (the minimal terminal coding harness) with [GitHub MCP](https://github.com/github/github-mcp-server), **web search**, and a simple **SQLite-backed cross-session memory** — ready to use on NixOS, macOS, and any system with Nix.

## Features

- **pi-coding-agent** — Packaged from npm with all dependencies (currently v0.75.5)
- **github-mcp-server** — Pre-integrated via a pi extension
- **web search** — Search the web via SearXNG (zero config, public instance)
- **pi-localmemory** — Zero-dependency cross-session memory: one SQLite file + FTS5, no server, no native binary, per-project scoping
- **Composable** — Mix and match extensions, or use `pi-full` for everything
- **NixOS module** — System-wide configuration
- **Home Manager module** — Per-user configuration

## Quick Start

### Run everything (recommended)

```bash
nix run github:cyprx/pi.nix#pi-full
```

### Run individual variants

```bash
nix run github:cyprx/pi.nix#pi-web-search    # web search only
nix run github:cyprx/pi.nix#pi-localmemory   # local SQLite memory only
nix run github:cyprx/pi.nix#pi-lite          # web search + local memory (no token needed)
nix run github:cyprx/pi.nix#pi-github-mcp    # GitHub MCP + web search
```

### Enter a dev shell

```bash
nix develop
pi-full   # or pi-web-search, pi-localmemory, pi-lite, pi-github-mcp
```

## GitHub Authentication

Export a GitHub personal access token with appropriate scopes:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
nix run .#pi-full
```

Or set it in your shell profile / NixOS configuration.

## Web Search

The web search extension adds a `web_search` tool out of the box. No API key needed.

```
> Search the web for the latest NixOS release
```

Pi will call `web_search` and return results from a public SearXNG instance.

### Custom search engine

Set `SEARXNG_URL` to use your own instance:

```bash
export SEARXNG_URL="https://search.example.com"
nix run .#pi-full
```

## Local Memory (`pi-localmemory`)

A dead-simple memory backend that lives in a single SQLite file. No second process, no native binary to fetch — it uses Node 24's built-in `node:sqlite` and FTS5.

### Run

```bash
nix run .#pi-localmemory     # or pi-lite, pi-full
```

### What it adds

- `memory_search` — FTS5-ranked search over your notes (project-scoped by default)
- `memory_save` — persist a titled note (with optional `kind`, `tags`, `scope`)
- `memory_forget` — delete a note by id
- `memory_health` — db path + entry counts
- `/localmemory-status` — quick status from inside pi
- `before_agent_start` recall — top-5 matches for your prompt injected into the system prompt
- `agent_end` capture — **opt-in only**: assistant text is saved only when it contains a `<remember>…</remember>` block

### `<remember>` capture syntax

The agent (or you, in your reply) wraps durable facts in a tag:

```
<remember kind="decision" tags="auth,oauth">
Use PKCE for native clients
---
Native apps cannot keep a client secret safe, so use PKCE for the OAuth flow.
</remember>

<remember scope="global">
Prefer ripgrep over grep
</remember>
```

- First line (or text before `---`) is the title; the rest is the body.
- Attributes: `kind` (decision/convention/bug/pref/note), `tags` (comma-separated), `scope` (`project` default, or `global`).

### Scoping

- **Per-project by default.** The project root is detected via `git rev-parse --show-toplevel`, falling back to `$PWD`.
- Searches return matches in the current project **plus** anything saved with `scope="global"`.
- Pass `scope: "global"` or `scope: "all"` to `memory_search` to broaden.
- Set `PI_MEMORY_GLOBAL=1` to make `global` the default scope for new saves.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PI_MEMORY_DB` | `$XDG_DATA_HOME/pi/memory.db` | SQLite file path |
| `PI_MEMORY_PROJECT` | (auto, git root or `$PWD`) | Override detected project root |
| `PI_MEMORY_GLOBAL` | (off) | When `1`, new saves default to global scope |

### Node version

Requires Node 24+ (stable `node:sqlite`). The flake's `pi-coding-agent` already pulls Node 24 from nixpkgs, so `nix run` works out of the box. On Node 22.5–23, set `NODE_OPTIONS=--experimental-sqlite`.

### Inspecting the store

It's just SQLite — use any tool you like:

```bash
sqlite3 ~/.local/share/pi/memory.db \
  "SELECT id, datetime(ts/1000,'unixepoch'), kind, title FROM memories ORDER BY ts DESC LIMIT 20"
```

## NixOS Module

```nix
{
  inputs.pi-nix.url = "github:cyprx/pi.nix";

  outputs = { self, nixpkgs, pi-nix }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        pi-nix.nixosModules.default
        {
          programs.pi-coding-agent = {
            enable = true;
            enableLocalMemory = true;
            enableGitHubMCP = true;
            githubTokenFile = "/run/secrets/github-token";
          };
        }
      ];
    };
  };
}
```

### Module options

| Option | Description |
|---|---|
| `enable` | Install base pi |
| `enableLocalMemory` | Install pi with `pi-localmemory` (no server) |
| `enableGitHubMCP` | Install pi with GitHub MCP + web search |
| `package` | Base pi package |
| `localMemoryPackage` | Package used when `enableLocalMemory` is true |
| `githubMCPPackage` | Package used when `enableGitHubMCP` is true |
| `fullPackage` | Package with everything (for custom use) |

## Home Manager Module

```nix
{
  imports = [ inputs.pi-nix.homeManagerModules.default ];

  programs.pi-coding-agent = {
    enable = true;
    enableLocalMemory = true;
    enableGitHubMCP = true;
    githubTokenFile = "${config.home.homeDirectory}/.config/github/token";
  };
}
```

## Available Packages

| Package | Description |
|---------|-------------|
| `pi-coding-agent` | Pi CLI only |
| `pi-web-search` | Pi + web search |
| `pi-localmemory` | Pi + local SQLite memory (no server) |
| `pi-lite` | Pi + web search + local memory (no server, no token) |
| `pi-github-mcp` | Pi + GitHub MCP + web search + gh CLI |
| `pi-full` | Pi + everything (default) |

## Available Apps

| App | Program |
|-----|---------|
| `pi` | Vanilla pi |
| `pi-web-search` | Pi + web search |
| `pi-localmemory` | Pi + local SQLite memory |
| `pi-lite` | Pi + web search + local memory |
| `pi-github-mcp` | Pi + GitHub MCP + web search + gh CLI |
| `pi-full` | Pi + everything (default) |

## How it works

This flake uses a composable architecture:

1. **Extensions** (`nix/pi-*`) are standalone pi extension packages that output TypeScript source files into `$out/share/pi-extensions/`.
2. **Builder** (`nix/lib/mk-pi-with-extensions.nix`) takes pi + a list of extensions and produces a wrapper that loads all of them via `pi -e <ext>/share/pi-extensions/extension.ts`.
3. **Composed packages** combine extensions into ready-to-use variants.

### Extension composition

```nix
# In flake.nix — compose any combination you want
pi-web-search  = mkPi "web-search"  [ pi-web-search-ext ] [] "";
pi-localmemory = mkPi "localmemory" [ pi-localmemory-ext ] [] "";
pi-lite        = mkPi "lite"        [ pi-web-search-ext pi-localmemory-ext ] [] "";
pi-github-mcp  = mkPi "github-mcp"  [ pi-web-search-ext pi-github-mcp-ext pi-github-cli-ext ] [] "";
pi-full        = mkPi "full"        [ pi-web-search-ext pi-localmemory-ext pi-github-mcp-ext pi-github-cli-ext ] [] "";
```

Each extension declares its runtime dependencies (`passthru.runtimeInputs`) and wrapper flags (`passthru.wrapperFlags`). The builder automatically merges PATH and flags from all extensions.

### `pi-localmemory` internals

1. Registers `memory_search`, `memory_save`, `memory_forget`, and `memory_health` tools.
2. Opens (and lazily creates) a SQLite database at `$XDG_DATA_HOME/pi/memory.db` via Node's built-in `node:sqlite`.
3. Stores rows in a `memories(id, ts, project, kind, title, body, tags)` table with a parallel FTS5 virtual table kept in sync by triggers, indexed with the `porter unicode61` tokenizer for prefix search and BM25 ranking.
4. Detects the current project with `git rev-parse --show-toplevel` (falling back to `$PWD`); rows with `project = "*"` are global.
5. Hooks `before_agent_start` to inject the top-5 matches for the user prompt into the system prompt, and `agent_end` to scan the assistant message for `<remember>` blocks and persist them.

## License

MIT
