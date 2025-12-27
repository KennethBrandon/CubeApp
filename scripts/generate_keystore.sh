#!/bin/bash

# Configuration
KEYSTORE_NAME="release-key.keystore"
ALIAS="key0"
VALIDITY_DAYS=10000

# 1. Ask for details or generate random
echo "Generating Android Keystore: $KEYSTORE_NAME"
echo "------------------------------------------------"

if [ -f "$KEYSTORE_NAME" ]; then
    echo "⚠️  $KEYSTORE_NAME already exists!"
    echo "Back it up or remove it to generate a new one."
    exit 1
fi

echo "Detailed instructions:"
echo "1. You will be prompted for a password. REMEMBER THIS PASSWORD."
echo "2. You will be asked for your name/org. You can fill it or skip."

# 2. Run Keytool
keytool -genkey -v -keystore $KEYSTORE_NAME -alias $ALIAS -keyalg RSA -keysize 2048 -validity $VALIDITY_DAYS

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Keystore generated successfully!"
    echo "------------------------------------------------"
    echo "NEXT STEPS FOR GITHUB ACTIONS:"
    echo "1. Run this command to get the Base64 string:"
    echo "   base64 -i $KEYSTORE_NAME | pbcopy"
    echo "   (This copies it to your clipboard)"
    echo ""
    echo "2. Go to GitHub Repo -> Settings -> Secrets and variables -> Actions"
    echo "3. Add New Repository Secret: ANDROID_KEYSTORE_BASE64"
    echo "   (Paste the clipboard content)"
    echo ""
    echo "4. Add Secret: KEYSTORE_PASSWORD (The password you just set)"
    echo "5. Add Secret: KEY_ALIAS (value: $ALIAS)"
    echo "6. Add Secret: KEY_PASSWORD (The same password, usually)"
    echo "------------------------------------------------"
    echo "DONT LOSE THIS FILE: $KEYSTORE_NAME"
else
    echo "❌ Keytool failed."
fi
