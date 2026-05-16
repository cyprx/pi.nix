{ lib
, buildNpmPackage
, fetchurl
, nodejs
, makeWrapper
}:

buildNpmPackage rec {
  pname = "pi-coding-agent";
  version = "0.74.0";

  src = fetchurl {
    url = "https://registry.npmjs.org/@earendil-works/pi-coding-agent/-/pi-coding-agent-${version}.tgz";
    hash = "sha256-l0pzuWGVvX1jDhFYaey14N16XDo47kkm3JlEhmPUo0Q=";
  };

  sourceRoot = "package";

  nativeBuildInputs = [ makeWrapper ];

  npmDepsHash = "sha256-zidLxfFsvuQsyfxBQqRE1fO/AVhMpLs8RagnqlJSjQI=";

  # Vendored lock file since the npm tarball doesn't include one
  postPatch = ''
    cp ${./package-lock.json} package-lock.json
  '';

  dontNpmBuild = true;

  postInstall = ''
    mkdir -p $out/bin
    makeWrapper ${nodejs}/bin/node $out/bin/pi \
      --add-flags "$out/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js"
  '';

  meta = with lib; {
    description = "Minimal terminal coding harness";
    homepage = "https://pi.dev";
    license = licenses.mit;
    mainProgram = "pi";
  };
}
