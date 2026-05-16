{ lib
, buildNpmPackage
, runCommand
, symlinkJoin
, nodejs
, makeWrapper
, pi-coding-agent
, agentmemory
}:

let
  extensionSrc = runCommand "pi-agentmemory-extension-src" { } ''
    mkdir -p $out
    cp ${./extension.ts} $out/extension.ts
    cp ${./security.ts} $out/security.ts
    cp ${./package.json} $out/package.json
    cp ${./package-lock.json} $out/package-lock.json
  '';

  extension = buildNpmPackage {
    pname = "pi-agentmemory-extension";
    version = "1.0.0";
    src = extensionSrc;

    npmDepsHash = "sha256-ZaCCA44zd2smSCK+xYUkN6pGLz1r3mbQ7U0tTVGGxp4=";

    dontNpmBuild = true;

    installPhase = ''
      runHook preInstall
      mkdir -p $out/share/pi-agentmemory
      cp -r . $out/share/pi-agentmemory/
      cp extension.ts $out/share/pi-agentmemory/extension.ts
      cp security.ts $out/share/pi-agentmemory/security.ts
      runHook postInstall
    '';
  };

  wrapper = runCommand "pi-agentmemory-wrapper" { nativeBuildInputs = [ makeWrapper ]; } ''
    mkdir -p $out/bin
    makeWrapper ${pi-coding-agent}/bin/pi $out/bin/pi-agentmemory \
      --prefix PATH : ${lib.makeBinPath [ nodejs agentmemory ]} \
      --add-flags "-e ${extension}/share/pi-agentmemory/extension.ts"
  '';
in

symlinkJoin {
  name = "pi-agentmemory";
  paths = [ extension wrapper ];
}
