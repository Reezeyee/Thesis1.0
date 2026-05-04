#!/usr/bin/env bash
# Print SHA-1 and SHA-256 for the default Android debug keystore (add in Firebase > Project settings > Your apps > Android app).
set -e
KEYSTORE="${HOME}/.android/debug.keystore"
if [[ ! -f "$KEYSTORE" ]]; then
  echo "No debug keystore at $KEYSTORE" >&2
  exit 1
fi
keytool -list -v -keystore "$KEYSTORE" -alias androiddebugkey -storepass android -keypass android
