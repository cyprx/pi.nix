{ lib
, buildNpmPackage
, fetchzip
, nodejs
, makeWrapper
, iii-engine
}:

buildNpmPackage rec {
  pname = "agentmemory";
  version = "0.9.16";

  src = fetchzip {
    url = "https://registry.npmjs.org/@agentmemory/agentmemory/-/agentmemory-${version}.tgz";
    sha256 = "12acj6rwqzcfqxa2qy140vmp47p5sz28qjpjnwmv7vfdxsdpccdy";
  };

  postPatch = ''
    cp ${./package-lock.json} package-lock.json
  '';

  npmDepsHash = "sha256-YQcZEdKUhzf0y6JypWEiGezqovuA0324Umz7MMf2Y1Y=";

  dontNpmBuild = true;

  npmFlags = [ "--omit=dev" "--omit=optional" "--legacy-peer-deps" ];

  nativeBuildInputs = [ makeWrapper ];

  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/agentmemory
    cp -r . $out/lib/agentmemory/

    mkdir -p $out/bin
    makeWrapper ${nodejs}/bin/node $out/bin/agentmemory \
      --prefix PATH : ${lib.makeBinPath [ nodejs iii-engine ]} \
      --set-default AGENTMEMORY_III_VERSION "${iii-engine.version}" \
      --add-flags "$out/lib/agentmemory/dist/cli.mjs"
    runHook postInstall
  '';

  meta = with lib; {
    description = "Persistent memory for AI coding agents";
    homepage = "https://github.com/rohitg00/agentmemory";
    license = licenses.asl20;
  };
}
