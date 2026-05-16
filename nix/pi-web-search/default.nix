{ lib
, buildNpmPackage
, runCommand
, nodejs
}:

let
  extensionSrc = runCommand "pi-web-search-extension-src" { } ''
    mkdir -p $out
    cp ${./extension.ts} $out/extension.ts
    cp ${./package.json} $out/package.json
    cp ${./package-lock.json} $out/package-lock.json
  '';
in

buildNpmPackage {
  pname = "pi-web-search-ext";
  version = "1.0.0";
  src = extensionSrc;

  npmDepsHash = "sha256-MRSfsynmZk6SL/3oczaTV25/aknoK9Pru4bMritNB/Y=";

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
    wrapperFlags = "";
  };

  meta = with lib; {
    description = "Pi extension for web search via SearXNG";
  };
}
