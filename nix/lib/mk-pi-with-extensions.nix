{ lib
, runCommand
, makeWrapper
, pi-coding-agent
, name
, extensions ? [ ]
, extraPackages ? [ ]
, extraWrapperFlags ? ""
}:

let
  allRuntimeInputs = lib.unique (
    lib.concatLists (map (ext: ext.passthru.runtimeInputs or [ ]) extensions)
    ++ extraPackages
  );

  allWrapperFlags = lib.concatStringsSep " " (
    map (ext: ext.passthru.wrapperFlags or "") extensions
  ) + " " + extraWrapperFlags;

  extFlags = lib.concatMapStringsSep " "
    (ext: "-e ${ext}/share/pi-extensions/extension.ts")
    extensions;
in

runCommand "pi-${name}"
  {
    nativeBuildInputs = [ makeWrapper ];
    passthru = {
      inherit extensions;
    };
  }
  ''
    mkdir -p $out/bin
    makeWrapper ${pi-coding-agent}/bin/pi $out/bin/pi-${name} \
      --prefix PATH : ${lib.makeBinPath allRuntimeInputs} \
      ${allWrapperFlags} \
      --add-flags "${extFlags}"
  ''
