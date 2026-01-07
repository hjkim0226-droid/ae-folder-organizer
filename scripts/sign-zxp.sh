#!/bin/bash
# ZXP 서명 스크립트 - 난독화된 코드로 ZXP 재생성

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

CEP_DIR="$ROOT_DIR/dist/cep"
ZXP_DIR="$ROOT_DIR/dist/zxp"
ZXP_PATH="$ZXP_DIR/com.snap.organizer.zxp"
CERT_PATH="$ROOT_DIR/node_modules/vite-cep-plugin/lib/.tmp/com.snap.organizer-cert.p12"
ZXP_SIGN_CMD="$ROOT_DIR/node_modules/vite-cep-plugin/lib/bin/ZXPSignCmd"

# ZXP 디렉토리 생성
mkdir -p "$ZXP_DIR"

# 기존 ZXP 삭제
if [ -f "$ZXP_PATH" ]; then
    rm "$ZXP_PATH"
    echo "Removed old ZXP file"
fi

# 인증서 생성 (없으면)
if [ ! -f "$CERT_PATH" ]; then
    echo "Creating self-signed certificate..."
    "$ZXP_SIGN_CMD" -selfSignedCert US CA Company com.snap.organizer password "$CERT_PATH"
fi

# ZXP 서명
echo "Signing ZXP with obfuscated code..."
"$ZXP_SIGN_CMD" -sign "$CEP_DIR" "$ZXP_PATH" "$CERT_PATH" password -tsa http://timestamp.digicert.com/

echo ""
echo "✅ ZXP created: $ZXP_PATH"
