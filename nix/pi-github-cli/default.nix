{ lib
, runCommand
, gh
}:

runCommand "pi-github-cli-ext"
  {
    passthru = {
      runtimeInputs = [ gh ];
      wrapperFlags = "";
    };
  }
  ''
    mkdir -p $out/share/pi-extensions
    cp ${./extension.ts} $out/share/pi-extensions/extension.ts
  ''
