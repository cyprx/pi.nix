# Pi Coding Agent with GitHub MCP + Web Search + Memory — Nix Flake

A Nix flake that packages [pi](https://pi.dev) (the minimal terminal coding harness) with [GitHub MCP](https://github.com/github/github-mcp-server), **web search**, and two persistent cross-session **memory** backends — ready to use on NixOS.

## Features

- **pi-coding-agent** — Packaged from npm with all dependencies
- **github-mcp-server** — Pre-integrated via a pi extension
- **web search** — Search the web via SearXNG (zero config, public instance)
- **pi-localmemory** — Zero-dependency cross-session memory: one SQLite file + FTS5, no server, per-project scoping
- **agentmemory** — Heavier memory backend with a separate iii-engine server (smart search, shared across users)
- **Composable** — Mix and match extensions, or use `pi-full` for everything
- **NixOS module** — System-wide configuration
- **Home Manager module** — Per-user configuration

### Which memory should I pick?

| | `pi-localmemory` | `pi-agentmemory` |
|---|---|---|
| Extra process | none | `nix run .#agentmemory` |
| Native binary | none (uses Node's `node:sqlite`) | `iii-engine` (Rust, prebuilt per platform) |
| Scope | per-project by default, opt-in global | global |
| Search | SQLite FTS5 (BM25 ranked) | smart/semantic search |
| Best for | a single developer's workstation | teams or rich semantic recall |

Both extensions register the same tool names (`memory_search`, `memory_save`, `memory_health`) so prompts written for one work with the other.

## Quick Start

### Run everything (recommended)

```bash
# Pi with web search + agentmemory + GitHub MCP
nix run github:cyprx/pi.nix#pi-full

# Start the agentmemory server (in another terminal)
nix run github:cyprx/pi.nix#agentmemory
```

### Run individual variants

```bash
nix run github:cyprx/pi.nix#pi-web-search    # web search only
nix run github:cyprx/pi.nix#pi-localmemory   # local SQLite memory only (no server)
nix run github:cyprx/pi.nix#pi-lite          # web search + local memory (no server, no token)
nix run github:cyprx/pi.nix#pi-agentmemory   # agentmemory only
nix run github:cyprx/pi.nix#pi-github-mcp    # GitHub MCP + web search
```

### Enter a dev shell

```bash
nix develop
pi-full   # or pi-web-search, pi-agentmemory, pi-github-mcp
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

- First line (or text before `---`) is the title; rest is the body.
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

Requires Node 24+ (stable `node:sqlite`). The flake's `pi-coding-agent` already pulls a Node 24 from nixpkgs, so `nix run` works out of the box. On Node 22.5–23, set `NODE_OPTIONS=--experimental-sqlite`.

## AgentMemory

[agentmemory](https://github.com/rohitg00/agentmemory) adds persistent cross-session memory to pi. It remembers prior decisions, bugs, workflows, and user preferences — so you never have to re-explain context.

### Start the memory server

In a separate terminal:

```bash
nix run .#agentmemory
# or just: agentmemory
```

This starts the memory server on `http://localhost:3111`.

### What it adds

- `memory_health` — confirm the shared memory server is reachable
- `memory_search` — search prior decisions, bugs, workflows, and preferences
- `memory_save` — write durable facts back to long-term memory
- `/agentmemory-status` — check health from inside pi
- `before_agent_start` recall — injects relevant memories into the prompt automatically
- `agent_end` capture — saves completed conversation turns back to agentmemory

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AGENTMEMORY_URL` | `http://localhost:3111` | agentmemory server URL |
| `AGENTMEMORY_SECRET` | (none) | Bearer token for protected instances |
| `AGENTMEMORY_REQUIRE_HTTPS` | (off) | When `1`, refuse plaintext HTTP for non-loopback |

## NixOS Module

```nix
{
  inputs.pi-nix.url = "github:youruser/pi-nix";

  outputs = { self, nixpkgs, pi-nix }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        pi-nix.nixosModules.default
        {
          programs.pi-coding-agent = {
            enable = true;
            enableAgentMemory = true;
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
| `enableAgentMemory` | Install pi with agentmemory (separate server) |
| `enableLocalMemory` | Install pi with `pi-localmemory` (no server) |
| `enableGitHubMCP` | Install pi with GitHub MCP + web search |
| `package` | Base pi package |
| `agentMemoryPackage` | Package used when `enableAgentMemory` is true |
| `localMemoryPackage` | Package used when `enableLocalMemory` is true |
| `githubMCPPackage` | Package used when `enableGitHubMCP` is true |
| `fullPackage` | Package with everything (for custom use) |

## Home Manager Module

```nix
{
  imports = [ inputs.pi-nix.homeManagerModules.default ];

  programs.pi-coding-agent = {
    enable = true;
    enableAgentMemory = true;
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
| `pi-agentmemory` | Pi + agentmemory (needs server) |
| `pi-lite` | Pi + web search + local memory (no server, no token) |
| `pi-github-mcp` | Pi + GitHub MCP + web search |
| `pi-full` | Pi + everything (default) |
| `agentmemory` | Standalone agentmemory server (bundles iii-engine) |
| `iii-engine` | iii-engine runtime (used by agentmemory) |

## Available Apps

| App | Program |
|-----|---------|
| `pi` | Vanilla pi |
| `pi-web-search` | Pi + web search |
| `pi-localmemory` | Pi + local SQLite memory |
| `pi-agentmemory` | Pi + agentmemory |
| `pi-lite` | Pi + web search + local memory |
| `pi-github-mcp` | Pi + GitHub MCP + web search |
| `pi-full` | Pi + everything (default) |

## How it works

This flake uses a composable architecture:

1. **Extensions** (`nix/pi-extensions/*`) are standalone pi extension packages that output TypeScript source files
2. **Builder** (`nix/lib/mk-pi-with-extensions.nix`) takes pi + a list of extensions and produces a wrapper that loads all extensions via `pi -e`
3. **Composed packages** combine extensions into ready-to-use variants

### Extension composition

```nix
# In the flake — compose any combination you want
pi-web-search  = mkPi "web-search"  [ pi-web-search-ext ] [] "";
pi-agentmemory = mkPi "agentmemory" [ pi-agentmemory-ext ] [] "";
pi-github-mcp  = mkPi "github-mcp"  [ pi-web-search-ext pi-github-mcp-ext ] [] "";
pi-full        = mkPi "full"        [ pi-web-search-ext pi-agentmemory-ext pi-github-mcp-ext ] [] "";
```

Each extension declares its runtime dependencies (`passthru.runtimeInputs`) and wrapper flags (`passthru.wrapperFlags`). The builder automatically merges PATH and flags from all extensions.

### `agentmemory`

1. Packages the `@agentmemory/agentmemory` npm package as a standalone server binary
2. Bundles the [iii-engine](https://github.com/iii-hq/iii) runtime (the Rust binary agentmemory depends on)
3. Runs the iii-engine memory server on port `3111` with file-based SQLite storage

> **Note:** You don't need to install iii-engine separately — this flake packages it automatically and puts it on PATH for both the standalone `agentmemory` server and the `pi-agentmemory` / `pi-full` wrappers.

### `pi-agentmemory` extension

1. Registers `memory_health`, `memory_search`, and `memory_save` tools
2. Hooks `session_start` to initialize session tracking
3. Hooks `before_agent_start` to query agentmemory and inject relevant memories into the system prompt
4. Hooks `agent_end` to capture conversation turns and persist them

## License

MIT
