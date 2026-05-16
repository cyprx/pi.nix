{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.programs.pi-coding-agent;
in
{
  options.programs.pi-coding-agent = {
    enable = mkEnableOption "pi coding agent";

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

    githubMCPPackage = mkOption {
      type = types.package;
      default = pkgs.pi-github-mcp or pkgs.callPackage ./pi-github-mcp {
        pi-coding-agent = cfg.package;
      };
      defaultText = literalExpression "pkgs.pi-github-mcp";
      description = "The pi-github-mcp package to use.";
    };
  };

  config = mkIf cfg.enable (mkMerge [
    {
      home.packages = [ cfg.package ];
    }

    (mkIf cfg.enableGitHubMCP {
      home.packages = [ cfg.githubMCPPackage ];

      # Create a shell alias or wrapper that exports the token
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
