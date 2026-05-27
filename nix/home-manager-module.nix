{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.programs.pi-coding-agent;

  mkPi = pkgs.callPackage ./lib/mk-pi-with-extensions.nix {
    pi-coding-agent = cfg.package;
  };

  pi-agentmemory-composed = mkPi {
    name = "agentmemory";
    extensions = [ (pkgs.callPackage ./pi-agentmemory { }) ];
  };

  pi-localmemory-composed = mkPi {
    name = "localmemory";
    extensions = [ (pkgs.callPackage ./pi-localmemory { }) ];
  };

  pi-github-mcp-composed = mkPi {
    name = "github-mcp";
    extensions = [ (pkgs.callPackage ./pi-web-search { }) (pkgs.callPackage ./pi-github-mcp { }) ];
  };

  pi-full-composed = mkPi {
    name = "full";
    extensions = [
      (pkgs.callPackage ./pi-web-search { })
      (pkgs.callPackage ./pi-agentmemory { })
      (pkgs.callPackage ./pi-github-mcp { })
    ];
  };
in
{
  options.programs.pi-coding-agent = {
    enable = mkEnableOption "pi coding agent";

    enableAgentMemory = mkEnableOption "agentmemory integration for pi (separate server)";

    enableLocalMemory = mkEnableOption "pi-localmemory (simple SQLite-backed cross-session memory, no server)";

    enableGitHubMCP = mkEnableOption "GitHub MCP integration for pi";

    githubTokenFile = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        Path to a file containing the GitHub personal access token.
        The token will be read from this file at runtime.
      '';
    };

    package = mkOption {
      type = types.package;
      default = pkgs.pi-coding-agent or pkgs.callPackage ./pi-coding-agent { };
      defaultText = literalExpression "pkgs.pi-coding-agent";
      description = "The pi coding agent package to use.";
    };

    agentMemoryPackage = mkOption {
      type = types.package;
      default = pkgs.pi-agentmemory or pi-agentmemory-composed;
      defaultText = literalExpression "pkgs.pi-agentmemory";
      description = "The pi-agentmemory package to use.";
    };

    localMemoryPackage = mkOption {
      type = types.package;
      default = pkgs.pi-localmemory or pi-localmemory-composed;
      defaultText = literalExpression "pkgs.pi-localmemory";
      description = "The pi-localmemory package to use.";
    };

    githubMCPPackage = mkOption {
      type = types.package;
      default = pkgs.pi-github-mcp or pi-github-mcp-composed;
      defaultText = literalExpression "pkgs.pi-github-mcp";
      description = "The pi-github-mcp package to use.";
    };

    fullPackage = mkOption {
      type = types.package;
      default = pkgs.pi-full or pi-full-composed;
      defaultText = literalExpression "pkgs.pi-full";
      description = "The pi-full package (everything) to use.";
    };
  };

  config = mkIf cfg.enable (mkMerge [
    {
      home.packages = [ cfg.package ];
    }

    (mkIf cfg.enableAgentMemory {
      home.packages = [ cfg.agentMemoryPackage ];
    })

    (mkIf cfg.enableLocalMemory {
      home.packages = [ cfg.localMemoryPackage ];
    })

    (mkIf cfg.enableGitHubMCP {
      home.packages = [ cfg.githubMCPPackage ];

      programs.bash.initExtra = mkIf (cfg.githubTokenFile != null) ''
        if [ -r "${cfg.githubTokenFile}" ]; then
          export GITHUB_PERSONAL_ACCESS_TOKEN=$(cat "${cfg.githubTokenFile}")
        fi
      '';

      programs.zsh.initExtra = mkIf (cfg.githubTokenFile != null) ''
        if [ -r "${cfg.githubTokenFile}" ]; then
          export GITHUB_PERSONAL_ACCESS_TOKEN=$(cat "${cfg.githubTokenFile}")
        fi
      '';

      programs.fish.shellInit = mkIf (cfg.githubTokenFile != null) ''
        if test -r "${cfg.githubTokenFile}"
          set -gx GITHUB_PERSONAL_ACCESS_TOKEN (cat "${cfg.githubTokenFile}")
        end
      '';
    })
  ]);
}
