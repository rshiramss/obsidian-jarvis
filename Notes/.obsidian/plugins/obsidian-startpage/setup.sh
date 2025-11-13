#!/bin/bash

# Setup script for Obsidian Jarvis Plugin
# This script downloads the Whisper model and binary

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BIN_DIR="$SCRIPT_DIR/bin"
MODELS_DIR="$SCRIPT_DIR/models"

echo "🚀 Setting up Obsidian Jarvis Plugin..."

# Create directories
mkdir -p "$BIN_DIR"
mkdir -p "$MODELS_DIR"

# Download Whisper model
MODEL_FILE="$MODELS_DIR/ggml-base.en.bin"
if [ ! -f "$MODEL_FILE" ]; then
    echo "📥 Downloading Whisper model (141 MB)..."
    curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" -o "$MODEL_FILE"
    echo "✅ Model downloaded successfully"
else
    echo "✅ Model already exists"
fi

# Check if whisper-cli binary exists
WHISPER_CLI="$BIN_DIR/whisper-cli"
if [ ! -f "$WHISPER_CLI" ]; then
    echo "⚠️  Whisper binary not found"
    echo "Please compile whisper.cpp and copy the binary to:"
    echo "  $BIN_DIR/whisper-cli"
    echo ""
    echo "Or download a pre-compiled binary for your platform"
else
    echo "✅ Whisper binary found"
    chmod +x "$WHISPER_CLI"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Enable the plugin in Obsidian (Settings → Community plugins)"
echo "2. Click the home icon to open the Start Page"
echo "3. Click the Record button to start voice recording with transcription"
