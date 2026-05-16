{ lib
, buildNpmPackage
, runCommand
, nodejs
, makeWrapper
, pi-coding-agent
, github-mcp-server
}:

let
  extensionSrc = runCommand "pi-github-mcp-extension-src" { } ''
    mkdir -p $out
    cp ${./extension.ts} $out/extension.ts
    cp ${./package.json} $out/package.json
    cp ${./package-lock.json} $out/package-lock.json
  '';

  extension = buildNpmPackage {
    pname = "pi-github-mcp-extension";
    version = "1.0.0";
    src = extensionSrc;

    npmDepsHash = "sha256-3j+ZlSJrfeCPctmthhW9aiYeprirnlEBPGxyGJDHLkk=";

    dontNpmBuild = true;

    installPhase = ''
      runHook preInstall
      mkdir -p $out
      cp -r . $out/
      runHook postInstall
    '';
  };
in

runCommand "pi-github-mcp" { nativeBuildInputs = [ makeWrapper ]; } ''
  mkdir -p $out/bin

  makeWrapper ${pi-coding-agent}/bin/pi $out/bin/pi-github-mcp \
    --prefix PATH : ${lib.makeBinPath [ github-mcp-server nodejs ]} \
    --set-default GITHUB_MCP_SERVER_PATH "${github-mcp-server}/bin/github-mcp-server" \
    --add-flags "-e ${extension}/extension.ts"

  makeWrapper ${pi-coding-agent}/bin/pi $out/bin/pi \
    --prefix PATH : ${lib.makeBinPath [ github-mcp-server nodejs ]} \
    --set-default GITHUB_MCP_SERVER_PATH "${github-mcp-server}/bin/github-mcp-server" \
    --add-flags "-e ${extension}/extension.ts"
''
