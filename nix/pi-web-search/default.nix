{ lib
, buildNpmPackage
, runCommand
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

    npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    dontNpmBuild = true;

    installPhase = ''
      runHook preInstall
      mkdir -p $out
      cp -r . $out/
      runHook postInstall
    '';
  };
in

runCommand "pi-web-search" { nativeBuildInputs = [ makeWrapper ]; } ''
  mkdir -p $out/bin

  makeWrapper ${pi-coding-agent}/bin/pi $out/bin/pi-web-search \
    --prefix PATH : ${lib.makeBinPath [ nodejs ]} \
    --add-flags "-e ${extension}/extension.ts"
''
