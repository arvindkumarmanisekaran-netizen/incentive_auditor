# Demo recording with synchronized voice-over

Run from `frontend/` while the FastAPI backend is available:

```bash
npm run test:demo-recording
```

The command installs Chromium and the Python narration dependencies, records the
guided 1920x1080 Playwright demo, captures the actual dynamic commentary
timeline, generates Indian-English narration, and writes these test artifacts:

- `Incentive-Auditor-Demo-Voiceover.mp4`
- `Incentive-Auditor-Demo-Voiceover.webm`
- `Incentive-Auditor-Demo-Narration.mp3`
- `Incentive-Auditor-Demo.srt`
- `commentary-timeline.json`
- `voiceover-manifest.json`

FFmpeg and ffprobe must be installed:

```bash
sudo apt install ffmpeg
```

Defaults:

- Voice: `en-IN-PrabhatNeural`
- Rate: `+15%`
- Volume: `+0%`
- Caption timing: at least the original requested pause, automatically extended
  using the configured narration word rate.

Override the voice or pace:

```bash
DEMO_TTS_VOICE=en-IN-NeerjaNeural DEMO_TTS_RATE=+10% npm run test:demo-recording
```

Record without generating narration:

```bash
npm run test:demo-recording:silent
```

The renderer accelerates only an individual narration clip that exceeds its
recorded caption window. This prevents adjacent voice clips from overlapping
while preserving the Playwright action timeline.
