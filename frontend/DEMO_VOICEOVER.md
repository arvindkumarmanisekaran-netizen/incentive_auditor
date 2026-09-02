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


## Resume voice-over without recording again

If the guided recording finishes but narration is interrupted, rerun only the renderer
with the existing video and timeline. Completed narration clips are validated and reused,
while missing clips are synthesized with four bounded concurrent requests:

```bash
python3 scripts/render_demo_voiceover.py \
  --video "<test-result>/Incentive-Auditor-Demo-1920x1080.webm" \
  --timeline "<test-result>/commentary-timeline.json" \
  --output-dir "<test-result>/voiceover" \
  --voice en-IN-NeerjaNeural \
  --rate=-20%
```

Set `--concurrency 1` if the TTS service rate-limits the connection.
