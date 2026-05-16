{ lib
, buildNpmPackage
, runCommand
, nodejs
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
in

buildNpmPackage {
  pname = "pi-agentmemory-ext";
  version = "1.0.0";
  src = extensionSrc;

  npmDepsHash = "sha256-ZaCCA44zd2smSCK+xYUkN6pGLz1r3mbQ7U0tTVGGxp4=";

  dontNpmBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/pi-extensions
    cp -r . $out/share/pi-extensions/
    cp extension.ts $out/share/pi-extensions/extension.ts
    cp security.ts $out/share/pi-extensions/security.ts
    runHook postInstall
  '';

  passthru = {
    runtimeInputs = [ nodejs agentmemory ];
    wrapperFlags = "";
  };

  meta = with lib; {
    description = "Pi extension for agentmemory persistent cross-session memory";
  };
}
