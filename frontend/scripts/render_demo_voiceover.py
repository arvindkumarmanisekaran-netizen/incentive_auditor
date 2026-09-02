#!/usr/bin/env python3
"""Generate synchronized narration and merge it into a Playwright demo video."""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
from pathlib import Path

import edge_tts
from pydub import AudioSegment


def command(*args: str) -> None:
    print("+", " ".join(args))
    subprocess.run(args, check=True)


def probe_duration_ms(video: Path) -> int:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return max(1, round(float(result.stdout.strip()) * 1000))


def srt_timestamp(milliseconds: int) -> str:
    milliseconds = max(0, milliseconds)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"


def write_srt(cues: list[dict], destination: Path) -> None:
    blocks = []
    for index, cue in enumerate(cues, start=1):
        start = int(cue["startMs"])
        end = max(start + 250, int(cue["endMs"]))
        text = " ".join(str(cue["text"]).split())
        blocks.append(
            f"{index}\n{srt_timestamp(start)} --> {srt_timestamp(end)}\n{text}\n"
        )
    destination.write_text("\n".join(blocks), encoding="utf-8")


async def synthesize_with_retry(
    text: str,
    destination: Path,
    voice: str,
    rate: str,
    volume: str,
    attempts: int = 3,
) -> None:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            await edge_tts.Communicate(
                text=text,
                voice=voice,
                rate=rate,
                volume=volume,
            ).save(str(destination))
            if destination.stat().st_size == 0:
                raise RuntimeError("TTS returned an empty audio file")
            return
        except Exception as error:  # edge-tts exposes multiple transport errors
            last_error = error
            if attempt < attempts:
                await asyncio.sleep(attempt * 2)
    raise RuntimeError(f"Unable to synthesize {destination.name}") from last_error


def atempo_filter(speed: float) -> str:
    factors: list[float] = []
    remaining = speed
    while remaining > 2.0:
        factors.append(2.0)
        remaining /= 2.0
    while remaining < 0.5:
        factors.append(0.5)
        remaining /= 0.5
    factors.append(remaining)
    return ",".join(f"atempo={factor:.6f}" for factor in factors)


def fit_clip(source: Path, allocated_ms: int, destination: Path) -> AudioSegment:
    clip = AudioSegment.from_file(source)
    if allocated_ms > 0 and len(clip) > allocated_ms:
        speed = len(clip) / allocated_ms
        command(
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(source),
            "-filter:a", atempo_filter(speed),
            "-t", f"{allocated_ms / 1000:.3f}",
            "-ar", "48000", "-ac", "2", str(destination),
        )
        clip = AudioSegment.from_file(destination)
    return clip.set_frame_rate(48_000).set_channels(2).fade_in(20).fade_out(60)


async def render(args: argparse.Namespace) -> None:
    for executable in ("ffmpeg", "ffprobe"):
        if shutil.which(executable) is None:
            raise RuntimeError(
                f"{executable} is required. Install it with: sudo apt install ffmpeg"
            )

    video = Path(args.video).resolve()
    timeline = Path(args.timeline).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    clips_dir = output_dir / "narration-clips"
    clips_dir.mkdir(exist_ok=True)

    payload = json.loads(timeline.read_text(encoding="utf-8"))
    cues = payload.get("cues", [])
    if not cues:
        raise RuntimeError("Commentary timeline contains no cues")

    duration_ms = probe_duration_ms(video)
    srt = output_dir / "Incentive-Auditor-Demo.srt"
    write_srt(cues, srt)

    narration = AudioSegment.silent(
        duration=duration_ms + 250,
        frame_rate=48_000,
    ).set_channels(2)

    for index, cue in enumerate(cues, start=1):
        text = " ".join(str(cue["text"]).split())
        source = clips_dir / f"{index:03}.mp3"
        fitted = clips_dir / f"{index:03}-fitted.wav"
        print(f"[{index}/{len(cues)}] {text}")
        await synthesize_with_retry(
            text, source, args.voice, args.rate, args.volume
        )
        start_ms = max(0, int(cue["startMs"]))
        end_ms = max(start_ms + 250, int(cue["endMs"]))
        clip = fit_clip(source, end_ms - start_ms, fitted)
        narration = narration.overlay(clip, position=start_ms)

    narration_mp3 = output_dir / "Incentive-Auditor-Demo-Narration.mp3"
    narration.export(narration_mp3, format="mp3", bitrate="192k")

    mp4 = output_dir / "Incentive-Auditor-Demo-Voiceover.mp4"
    command(
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(video), "-i", str(narration_mp3),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        "-shortest", str(mp4),
    )

    webm = output_dir / "Incentive-Auditor-Demo-Voiceover.webm"
    command(
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(video), "-i", str(narration_mp3),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "libopus", "-b:a", "160k",
        "-shortest", str(webm),
    )

    manifest = {
        "voice": args.voice,
        "rate": args.rate,
        "volume": args.volume,
        "cueCount": len(cues),
        "videoDurationMs": duration_ms,
        "outputs": {
            "mp4": str(mp4),
            "webm": str(webm),
            "audio": str(narration_mp3),
            "subtitles": str(srt),
        },
    }
    (output_dir / "voiceover-manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    shutil.rmtree(clips_dir)
    print(json.dumps(manifest, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--timeline", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--voice", default="en-IN-NeerjaNeural")
    parser.add_argument("--rate", default="-20%")
    parser.add_argument("--volume", default="+0%")
    return parser.parse_args()


if __name__ == "__main__":
    try:
        asyncio.run(render(parse_args()))
    except Exception as error:
        print(f"Voice-over generation failed: {error}", file=sys.stderr)
        raise
