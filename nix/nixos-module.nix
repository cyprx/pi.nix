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
      default = pkgs.pi-agentmemory or pi-agentmemory-composed;
      defaultText = literalExpression "pkgs.pi-agentmemory";
      description = "The pi-agentmemory package to use.";
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

  config = mkMerge [
    (mkIf cfg.enable {
      environment.systemPackages = [ cfg.package ];
    })

    (mkIf (cfg.enable && cfg.enableAgentMemory) {
      environment.systemPackages = [ cfg.agentMemoryPackage ];
    })

    (mkIf (cfg.enable && cfg.enableGitHubMCP) {
      environment.systemPackages = [ cfg.githubMCPPackage ];
    })

    (mkIf (cfg.enableGitHubMCP && cfg.githubTokenFile != null) {
      environment.etc."pi-github-mcp/env".text = ''
        GITHUB_PERSONAL_ACCESS_TOKEN=$(cat ${cfg.githubTokenFile})
      '';
    })
  ];
}
