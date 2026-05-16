{ lib
, buildNpmPackage
, runCommand
, symlinkJoin
, nodejs
, makeWrapper
, pi-coding-agent
}:

let
  extensionSrc = runCommand "pi-web-search-extension-src" { } ''
    mkdir -p $out
    cp ${./extension.ts} $out/extension.ts
    cp ${./package.json} $out/package.json
    cp ${./package-lock.json} $out/package-lock.json
  '';

  extension = buildNpmPackage {
    pname = "pi-web-search-extension";
    version = "1.0.0";
    src = extensionSrc;

    npmDepsHash = "sha256-MRSfsynmZk6SL/3oczaTV25/aknoK9Pru4bMritNB/Y=";

    dontNpmBuild = true;

    installPhase = ''
      runHook preInstall
      mkdir -p $out/share/pi-web-search
      cp -r . $out/share/pi-web-search/
      cp extension.ts $out/share/pi-web-search/extension.ts
      runHook postInstall
    '';
  };

  wrapper = runCommand "pi-web-search-wrapper" { nativeBuildInputs = [ makeWrapper ]; } ''
    mkdir -p $out/bin
    makeWrapper ${pi-coding-agent}/bin/pi $out/bin/pi-web-search \
      --prefix PATH : ${lib.makeBinPath [ nodejs ]} \
      --add-flags "-e ${extension}/share/pi-web-search/extension.ts"
  '';
in

symlinkJoin {
  name = "pi-web-search";
  paths = [ extension wrapper ];
}
