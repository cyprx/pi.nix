{ lib
, buildNpmPackage
, fetchurl
, nodejs
, makeWrapper
}:

buildNpmPackage rec {
  pname = "pi-coding-agent";
  version = "0.77.0";

  src = fetchurl {
    url = "https://registry.npmjs.org/@earendil-works/pi-coding-agent/-/pi-coding-agent-${version}.tgz";
    hash = "sha256-EFOKehAW6zEIyx72Xb9t4uMdJvLAka455W72qcIaTDE=";
  };

  sourceRoot = "package";

  nativeBuildInputs = [ makeWrapper ];

  # Updated whenever package-lock.json changes. Run with lib.fakeHash to refresh.
  # Updated whenever package-lock.json changes. Use lib.fakeHash to refresh.
  npmDepsHash = "sha256-X9HwvugNHs7PZrHfRbZLm1jQ3b4yakHkqBQKIK8PK34=";

  # Vendored lock file. Pi 0.75+ ships an npm-shrinkwrap.json, but it lacks
  # integrity hashes for the internal @earendil-works/* siblings. Our vendored
  # file is that shrinkwrap with the missing integrities injected; replace both
  # files so npm uses ours.
  postPatch = ''
    rm -f npm-shrinkwrap.json
    cp ${./package-lock.json} package-lock.json
    # The shipped shrinkwrap doesn't list devDependencies, and we don't need
    # them at runtime. Strip them from package.json so npm doesn't try to
    # reconcile and fetch from the sealed cache.
    ${nodejs}/bin/node -e '
      const fs = require("fs");
      const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
      delete p.devDependencies;
      fs.writeFileSync("package.json", JSON.stringify(p, null, 2));
    '
  '';

  # devDependencies (@types/*, typescript, vitest, shx) aren't in the shipped
  # shrinkwrap and aren't needed at runtime.
  npmFlags = [ "--omit=dev" ];

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
