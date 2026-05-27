{ lib
, buildNpmPackage
, runCommand
, nodejs
}:

let
  extensionSrc = runCommand "pi-localmemory-extension-src" { } ''
    mkdir -p $out
    cp ${./extension.ts} $out/extension.ts
    cp ${./package.json} $out/package.json
    cp ${./package-lock.json} $out/package-lock.json
  '';
in

buildNpmPackage {
  pname = "pi-localmemory-ext";
  version = "1.0.0";
  src = extensionSrc;

  # Updated whenever package-lock.json changes. Run with lib.fakeHash to refresh.
  npmDepsHash = "sha256-ieRIDOCZ4oMRvoi5MkI2w1e0KsqyRMnCvE8g2Bju0VA=";

  dontNpmBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/pi-extensions
    cp -r . $out/share/pi-extensions/
    cp extension.ts $out/share/pi-extensions/extension.ts
    runHook postInstall
  '';

  passthru = {
    runtimeInputs = [ nodejs ];
    # node:sqlite is stable in Node 24+. On 22.5-23 it requires --experimental-sqlite.
    # We pass the flag conservatively — Node 24+ accepts but ignores it via NODE_OPTIONS warning;
    # users can override by setting NODE_OPTIONS themselves.
    wrapperFlags = "";
  };

  meta = with lib; {
    description = "Pi extension for simple cross-session memory (SQLite + FTS5, no server)";
  };
}
