{
  description = "Pi coding agent with GitHub MCP integration for NixOS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        pi-coding-agent = pkgs.callPackage ./nix/pi-coding-agent { };
        pi-web-search = pkgs.callPackage ./nix/pi-web-search {
          inherit pi-coding-agent;
        };
        pi-github-mcp = pkgs.callPackage ./nix/pi-github-mcp {
          inherit pi-coding-agent pi-web-search;
        };
      in
      {
        packages = {
          inherit pi-coding-agent pi-web-search pi-github-mcp;
          default = pi-github-mcp;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [ pi-github-mcp ];
          shellHook = ''
            echo "Pi coding agent with GitHub MCP + Web Search"
            echo "Run: pi-github-mcp"
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
          pi-github-mcp = {
            type = "app";
            program = "${pi-github-mcp}/bin/pi-github-mcp";
          };
          default = self.apps.${system}.pi-github-mcp;
        };
      })
    // {
      nixosModules.default = import ./nix/nixos-module.nix;
      homeManagerModules.default = import ./nix/home-manager-module.nix;
    };
}
