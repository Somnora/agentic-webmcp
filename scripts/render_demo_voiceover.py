"""Generate and time-align the Agentic WebMCP demo narration with Gemini TTS."""

from __future__ import annotations

import argparse
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path

from google import genai
from google.genai import types


@dataclass(frozen=True)
class Segment:
    start: float
    end: float
    text: str


SEGMENTS = [
    Segment(
        0,
        12,
        "Shopping agents can find options, but people still need to know why one listing won. "
        "Agentic turns that research into a shared, inspectable decision.",
    ),
    Segment(
        12,
        22,
        "The agent begins by discovering the exact public origins and adapters this page permits.",
    ),
    Segment(
        22,
        30,
        "It selects Independent Gear Exchange, a clearly labeled controlled guitar marketplace. "
        "The exact host and live adapter remain visible.",
    ),
    Segment(
        30,
        48,
        "A natural language goal becomes a typed recommendation call. The shortlist is scored by "
        "relevance, condition, delivered price, seller confidence, and returns.",
    ),
    Segment(
        48,
        78,
        "This is the converter. One real H T T P S page becomes compact Markdown plus a "
        "structured Offer, with its canonical U R L and provenance intact. The exact host and "
        "path are validated before presentation elements and unsafe controls are removed.",
    ),
    Segment(
        78,
        98,
        "Because every adapter produces the same Offer shape, the agent can compare condition, "
        "seller evidence, shipping, and returns without learning a second catalog model.",
    ),
    Segment(
        98,
        120,
        "The agent prepares one listing for review, then stops. Nothing has been ordered or "
        "charged, and the approval boundary is visible to the human.",
    ),
    Segment(
        120,
        140,
        "The human approves the selection for handoff. Only that visible button creates the "
        "page-local decision record. Payment remains on the source merchant, and there is no "
        "agent commit, checkout, or payment tool.",
    ),
    Segment(
        140,
        148,
        "Agents get a useful open-web interface, while people retain source visibility and "
        "final control over writes.",
    ),
]


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def output(*args: str) -> str:
    return subprocess.check_output(args, text=True).strip()


def duration(path: Path) -> float:
    return float(
        output(
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        )
    )


def save_pcm_wav(path: Path, pcm: bytes) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24_000)
        wav.writeframes(pcm)


def synthesize(client: genai.Client, segment: Segment, path: Path) -> None:
    target = segment.end - segment.start - 0.8
    prompt = f"""Audio profile:
A calm product architect presenting a trustworthy agent interface.

Scene:
A concise product demonstration for technical hackathon judges.

Director's notes:
Use a confident, natural American English delivery. Sound clear and thoughtful, not theatrical.
Keep the pace measured with restrained emphasis on WebMCP, Offer, provenance, and human control.
Do not add an introduction, commentary, music, or sound effects. Read only the transcript.
Aim to finish this passage naturally in approximately {target:.1f} seconds.

Transcript:
{segment.text}
"""
    response = client.models.generate_content(
        model="gemini-3.1-flash-tts-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Lapetus"
                    )
                )
            ),
        ),
    )
    parts = response.candidates[0].content.parts
    audio = next((part.inline_data.data for part in parts if part.inline_data), None)
    if not audio:
        raise RuntimeError("Gemini returned no audio for a narration segment")
    save_pcm_wav(path, audio)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Silent screen recording")
    parser.add_argument("output", type=Path, help="Final video with narration")
    parser.add_argument(
        "--work-dir", type=Path, default=Path("build/demo-voiceover")
    )
    args = parser.parse_args()

    source = args.input.expanduser().resolve()
    destination = args.output.expanduser().resolve()
    work_dir = args.work_dir.expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Recording not found: {source}")
    work_dir.mkdir(parents=True, exist_ok=True)
    destination.parent.mkdir(parents=True, exist_ok=True)

    project = output("gcloud", "config", "get-value", "project")
    if not project or project == "(unset)":
        raise SystemExit("No active Google Cloud project is configured")
    client = genai.Client(vertexai=True, project=project, location="us-central1")

    inputs: list[str] = []
    filters: list[str] = []
    labels: list[str] = []
    for index, segment in enumerate(SEGMENTS, start=1):
        wav = work_dir / f"segment-{index:02d}.wav"
        if not wav.exists():
            print(f"Synthesizing segment {index}/{len(SEGMENTS)} with Lapetus...")
            synthesize(client, segment, wav)
        raw_duration = duration(wav)
        available = segment.end - segment.start - 0.5
        speed = max(1.0, raw_duration / available)
        label = f"voice{index}"
        inputs.extend(["-i", str(wav)])
        filters.append(
            f"[{index - 1}:a]atempo={speed:.6f},"
            f"adelay={int((segment.start + 0.25) * 1000)}:all=1[{label}]"
        )
        labels.append(f"[{label}]")
        print(
            f"  segment {index}: {raw_duration:.2f}s generated, "
            f"{available:.2f}s available, speed {speed:.3f}x"
        )

    voice_track = work_dir / "agentic-webmcp-lapetus-voiceover.wav"
    video_duration = duration(source)
    filters.append(
        "".join(labels)
        + f"amix=inputs={len(labels)}:duration=longest:dropout_transition=0,"
        + f"apad=whole_dur={video_duration:.6f},atrim=duration={video_duration:.6f},"
        + "loudnorm=I=-16:TP=-1.5:LRA=7[voiceover]"
    )
    run(
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[voiceover]",
        "-ar",
        "48000",
        str(voice_track),
    )
    run(
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-i",
        str(voice_track),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-t",
        f"{video_duration:.6f}",
        str(destination),
    )
    print(f"Created {destination}")


if __name__ == "__main__":
    main()
