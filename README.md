# Pi Coding Agent with GitHub MCP — Nix Flake

A Nix flake that packages [pi](https://pi.dev) (the minimal terminal coding harness) with [GitHub MCP](https://github.com/github/github-mcp-server) ready to use on NixOS.

## Features

- **pi-coding-agent** — Packaged from npm with all dependencies
- **github-mcp-server** — Pre-integrated via a pi extension
- **NixOS module** — System-wide configuration
- **Home Manager module** — Per-user configuration

## Quick Start

### Run without installing

```bash
nix run github:cyprx/pi.nix#pi-github-mcp
```

### Enter a dev shell

```bash
nix develop
pi-github-mcp
```

## GitHub Authentication

Export a GitHub personal access token with appropriate scopes:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
nix run .#pi-github-mcp
```

Or set it in your shell profile / NixOS configuration.

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
            enableGitHubMCP = true;
            githubTokenFile = "/run/secrets/github-token";
          };
        }
      ];
    };
  };
}
```

## Home Manager Module

```nix
{
  imports = [ inputs.pi-nix.homeManagerModules.default ];

  programs.pi-coding-agent = {
    enable = true;
    enableGitHubMCP = true;
    githubTokenFile = "${config.home.homeDirectory}/.config/github/token";
  };
}
```

## Available Packages

| Package | Description |
|---------|-------------|
| `pi-coding-agent` | Pi CLI only |
| `pi-github-mcp` | Pi with GitHub MCP extension preloaded |

## How it works

The `pi-github-mcp` package:

1. Installs the `github-mcp-server` binary from nixpkgs into `PATH`
2. Loads a pi extension (`nix/pi-github-mcp/extension.ts`) that:
   - Spawns `github-mcp-server` as a subprocess
   - Discovers available GitHub tools via MCP
   - Registers each tool as a `github_<name>` pi custom tool
3. Wraps `pi` so the extension is always loaded via `-e`

## License

MIT
