{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.programs.pi-coding-agent;
in
{
  options.programs.pi-coding-agent = {
    enable = mkEnableOption "pi coding agent";

    enableAgentMemory = mkEnableOption "agentmemory integration for pi";

    enableGitHubMCP = mkEnableOption "GitHub MCP integration for pi";

    githubTokenFile = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        Path to a file containing the GitHub personal access token.
        The token will be read and exported as GITHUB_PERSONAL_ACCESS_TOKEN.
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
      default = pkgs.pi-agentmemory or pkgs.callPackage ./pi-agentmemory {
        pi-coding-agent = cfg.package;
      };
      defaultText = literalExpression "pkgs.pi-agentmemory";
      description = "The pi-agentmemory package to use.";
    };

    githubMCPPackage = mkOption {
      type = types.package;
      default = pkgs.pi-github-mcp or pkgs.callPackage ./pi-github-mcp {
        pi-coding-agent = cfg.package;
      };
      defaultText = literalExpression "pkgs.pi-github-mcp";
      description = "The pi-github-mcp package to use.";
    };
  };

  config = mkMerge [
    (mkIf cfg.enable {
      environment.systemPackages = [ cfg.package ];
    })

    (mkIf (cfg.enable && cfg.enableAgentMemory) {
      environment.systemPackages = [ cfg.agentMemoryPackage ];
    })

    (mkIf (cfg.enable && cfg.enableGitHubMCP) {
      environment.systemPackages = [ cfg.githubMCPPackage ];

      # Optionally set up a systemd user service for github-mcp-server
      # or just rely on the wrapper script spawning it on demand
    })

    (mkIf (cfg.enableGitHubMCP && cfg.githubTokenFile != null) {
      # Export token via environment.d for user sessions
      environment.etc."pi-github-mcp/env".text = ''
        GITHUB_PERSONAL_ACCESS_TOKEN=$(cat ${cfg.githubTokenFile})
      '';
    })
  ];
}
