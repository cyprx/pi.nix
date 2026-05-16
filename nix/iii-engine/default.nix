{ lib
, stdenv
, fetchurl
, autoPatchelfHook
, zlib
}:

let
  version = "0.11.2";

  platform = stdenv.hostPlatform.system;

  archMap = {
    "x86_64-linux" = {
      asset = "iii-x86_64-unknown-linux-gnu.tar.gz";
      sha256 = "sha256-nIPEd4i070vutl3ZvzfpT5k3cM09uHRGTDzhzckjUs0=";
    };
    "aarch64-linux" = {
      asset = "iii-aarch64-unknown-linux-gnu.tar.gz";
      sha256 = lib.fakeHash;
    };
    "x86_64-darwin" = {
      asset = "iii-x86_64-apple-darwin.tar.gz";
      sha256 = lib.fakeHash;
    };
    "aarch64-darwin" = {
      asset = "iii-aarch64-apple-darwin.tar.gz";
      sha256 = lib.fakeHash;
    };
  };

  selected = archMap.${platform} or (throw "Unsupported platform: ${platform}");
in

stdenv.mkDerivation {
  pname = "iii-engine";
  inherit version;

  src = fetchurl {
    url = "https://github.com/iii-hq/iii/releases/download/iii/v${version}/${selected.asset}";
    sha256 = selected.sha256;
  };

  nativeBuildInputs = lib.optional stdenv.hostPlatform.isLinux autoPatchelfHook;
  buildInputs = lib.optionals stdenv.hostPlatform.isLinux [ zlib stdenv.cc.cc.lib ];

  sourceRoot = ".";

  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin
    cp iii $out/bin/iii
    runHook postInstall
  '';

  meta = with lib; {
    description = "iii-engine — the runtime for agentmemory";
    homepage = "https://github.com/iii-hq/iii";
    license = licenses.mit;
    sourceProvenance = with sourceTypes; [ binaryNativeCode ];
    platforms = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
  };
}
