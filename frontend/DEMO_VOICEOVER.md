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

- Voice: `en-IN-NeerjaNeural`
- Rate: `-20%` (approximately 30% slower than the previous `+15%` setting)
- Volume: `+0%`
- Caption timing: at least the original requested pause, automatically extended
  using the configured narration word rate.

Override the voice or pace:

```bash
DEMO_TTS_VOICE=en-IN-PrabhatNeural DEMO_TTS_RATE=-10% npm run test:demo-recording
```

Record without generating narration:

```bash
npm run test:demo-recording:silent
```

The recorder preflights July investigation data and selects a representative with covered
incentive and payout records so the analytical views are populated. This selection detail
is intentionally excluded from the audience-facing subtitles. The slower caption pacing
keeps the neural narration natural; the renderer accelerates only an individual narration
clip that still exceeds its recorded caption window. This prevents adjacent voice clips from overlapping
while preserving the Playwright action timeline.
