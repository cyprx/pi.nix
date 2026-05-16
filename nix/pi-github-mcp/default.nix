{ lib
, buildNpmPackage
, runCommand
, nodejs
, github-mcp-server
}:

let
  extensionSrc = runCommand "pi-github-mcp-extension-src" { } ''
    mkdir -p $out
    cp ${./extension.ts} $out/extension.ts
    cp ${./package.json} $out/package.json
    cp ${./package-lock.json} $out/package-lock.json
  '';
in

buildNpmPackage {
  pname = "pi-github-mcp-ext";
  version = "1.0.0";
  src = extensionSrc;

  npmDepsHash = "sha256-3j+ZlSJrfeCPctmthhW9aiYeprirnlEBPGxyGJDHLkk=";

  dontNpmBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/pi-extensions
    cp -r . $out/share/pi-extensions/
    cp extension.ts $out/share/pi-extensions/extension.ts
    runHook postInstall
  '';

  passthru = {
    runtimeInputs = [ nodejs github-mcp-server ];
    wrapperFlags = ''--set-default GITHUB_MCP_SERVER_PATH "${github-mcp-server}/bin/github-mcp-server"'';
  };

  meta = with lib; {
    description = "Pi extension for GitHub MCP integration";
  };
}
