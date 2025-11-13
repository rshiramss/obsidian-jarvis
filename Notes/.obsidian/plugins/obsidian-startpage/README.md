# Obsidian Jarvis - Voice Recording with AI Transcription

A self-contained Obsidian plugin that provides voice recording with automatic AI-powered transcription using Whisper.

## Features

- **Voice Recording**: Click the Record button to capture audio directly in Obsidian
- **AI Transcription**: Automatically transcribes your voice recordings using Whisper
- **Self-Contained**: No external dependencies or setup required - everything is bundled!
- **16 kHz Mono WAV**: Optimized audio format for accurate transcription
- **Beautiful UI**: Modern, intuitive interface with recent notes, calendar, and tasks

## Installation (One-Time Setup)

### Option 1: Automatic Setup (Recommended)

1. **Clone or download** this repository
2. **Copy the plugin folder** to your vault:
   ```bash
   cp -r obsidian-startpage /path/to/your/vault/.obsidian/plugins/
   ```
3. **Run the setup script**:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins/obsidian-startpage
   ./setup.sh
   ```
   This will automatically download the Whisper model (141 MB)

4. **Enable the plugin** in Obsidian:
   - Go to Settings → Community plugins
   - Find "Startpage" and toggle it on

### Option 2: Manual Setup

1. **Clone or download** this repository
2. **Copy the plugin folder** to your vault:
   ```bash
   cp -r obsidian-startpage /path/to/your/vault/.obsidian/plugins/
   ```
3. **Download the Whisper model** manually:
   - Download from: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
   - Place in: `obsidian-startpage/models/ggml-base.en.bin`

4. **Copy the Whisper binary**:
   - Compile whisper.cpp or download a pre-built binary
   - Place in: `obsidian-startpage/bin/whisper`
   - Make it executable: `chmod +x obsidian-startpage/bin/whisper`

5. **Enable the plugin** in Obsidian:
   - Go to Settings → Community plugins
   - Find "Startpage" and toggle it on

## How to Use

1. **Open the Start Page**:
   - Click the home icon in the left ribbon, or
   - Use the command palette (Cmd/Ctrl + P) and search for "Open start page"

2. **Record a Voice Note**:
   - Click the "● Record" button
   - Speak into your microphone
   - Click "■ Stop" when finished

3. **View Your Transcript**:
   - A new note is automatically created with:
     - Recording metadata (date, duration)
     - Full transcript of your speech
     - Link to the audio file

## What's Included

This plugin is completely self-contained:

- ✅ Whisper binary (35 KB)
- ✅ AI model - ggml-base.en.bin (141 MB)
- ✅ Plugin code (main.js, manifest.json, styles.css)

No external installations required!

## Technical Details

- **Audio Format**: 16 kHz mono WAV (optimized for Whisper)
- **AI Model**: Whisper base.en (English)
- **Transcription**: Runs locally on your machine (private and secure)
- **Platform**: macOS (ARM64)

## Troubleshooting

### Transcription Not Working?

The plugin should work out of the box. If you encounter issues:

1. Check that the plugin folder contains:
   - `bin/whisper` (executable)
   - `models/ggml-base.en.bin` (model file)

2. Verify file permissions:
   ```bash
   chmod +x .obsidian/plugins/obsidian-startpage/bin/whisper
   ```

3. Check the Obsidian console (View → Toggle Developer Tools) for error messages

### Custom Whisper Model

If you want to use a different Whisper model:

1. Go to Settings → Start Page
2. Enter the path to your model in "Whisper model path"

## Privacy

All transcription happens locally on your computer. No data is sent to external servers.

## Credits

- Built on [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- Uses OpenAI's Whisper model
