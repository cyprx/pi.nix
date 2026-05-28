{
  description = "Pi coding agent with GitHub MCP + Web Search + local SQLite memory — Nix Flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        lib = pkgs.lib;

        pi-coding-agent = pkgs.callPackage ./nix/pi-coding-agent { };

        # Extension packages (source only, no wrapper)
        # nodejs and github-mcp-server are resolved from pkgs by callPackage
        pi-web-search-ext = pkgs.callPackage ./nix/pi-web-search { };
        pi-localmemory-ext = pkgs.callPackage ./nix/pi-localmemory { };
        pi-github-mcp-ext = pkgs.callPackage ./nix/pi-github-mcp { };
        pi-github-cli-ext = pkgs.callPackage ./nix/pi-github-cli { };

        # Generic builder: compose pi with any set of extensions
        mkPi = name: extensions: extraPackages: extraWrapperFlags:
          pkgs.callPackage ./nix/lib/mk-pi-with-extensions.nix {
            inherit pi-coding-agent name extensions extraPackages extraWrapperFlags;
          };

        # Composed packages — mix and match extensions as needed
        pi-web-search = mkPi "web-search" [ pi-web-search-ext ] [ ] "";
        pi-localmemory = mkPi "localmemory" [ pi-localmemory-ext ] [ ] "";
        pi-github-mcp = mkPi "github-mcp" [ pi-web-search-ext pi-github-mcp-ext pi-github-cli-ext ] [ ] "";
        # Lite: no server, no token — just web search + local memory.
        pi-lite = mkPi "lite" [ pi-web-search-ext pi-localmemory-ext ] [ ] "";
        pi-full = mkPi "full" [ pi-web-search-ext pi-localmemory-ext pi-github-mcp-ext pi-github-cli-ext ] [ ] "";
      in
      {
        packages = {
          inherit pi-coding-agent
            pi-web-search pi-localmemory
            pi-github-mcp pi-lite pi-full;
          default = pi-full;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [ pi-full ];
          shellHook = ''
            echo "Pi coding agent — available variants:"
            echo "  pi              vanilla pi"
            echo "  pi-web-search   pi + web search"
            echo "  pi-localmemory  pi + local SQLite memory (no server)"
            echo "  pi-lite         pi + web search + local memory"
            echo "  pi-github-mcp   pi + GitHub MCP + web search + gh CLI"
            echo "  pi-full         pi + everything"
          '';
        };

        apps = {
          pi = {
            type = "app";
            program = "${pi-coding-agent}/bin/pi";
          };
          pi-web-search = {
            type = "app";
            program = "${pi-web-search}/bin/pi-web-search";
          };
          pi-localmemory = {
            type = "app";
            program = "${pi-localmemory}/bin/pi-localmemory";
          };
          pi-lite = {
            type = "app";
            program = "${pi-lite}/bin/pi-lite";
          };
          pi-github-mcp = {
            type = "app";
            program = "${pi-github-mcp}/bin/pi-github-mcp";
          };
          pi-full = {
            type = "app";
            program = "${pi-full}/bin/pi-full";
          };
          default = self.apps.${system}.pi-full;
        };
      })
    // {
      nixosModules.default = import ./nix/nixos-module.nix;
      homeManagerModules.default = import ./nix/home-manager-module.nix;
    };
}
