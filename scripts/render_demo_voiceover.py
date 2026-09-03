"""Generate Ribband narration from the same sequence used by the presenter."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path

SEQUENCE_PATH = Path(__file__).resolve().parents[1] / "public" / "demo-sequence.json"
PROFILE = json.loads(SEQUENCE_PATH.read_text())
MODEL = PROFILE["model"]
VOICE = PROFILE["voice"]


@dataclass(frozen=True)
class Segment:
    start: float
    end: float
    text: str
    id: str = ""


def load_segments(sequence_path: Path = SEQUENCE_PATH, timing_path: Path | None = None) -> list[Segment]:
    sequence = json.loads(sequence_path.read_text())
    cues = json.loads(timing_path.read_text())["cues"] if timing_path else None
    if cues is not None and [cue["id"] for cue in cues] != [step["id"] for step in sequence["steps"]]:
        raise ValueError("Edit cue ids must match the current Ribband sequence in order.")
    segments = []
    previous_end = 0.0
    for index, step in enumerate(sequence["steps"]):
        start = float(cues[index]["start"]) if cues else previous_end
        end = float(cues[index]["end"]) if cues else start + step["duration"] / 1000
        if not math.isfinite(start) or not math.isfinite(end) or start < previous_end or end - start <= 1:
            raise ValueError("Edit cues must be finite, ordered, non-overlapping, and longer than one second.")
        if not step.get("narration", "").strip():
            raise ValueError("Every demo step needs narration.")
        segments.append(Segment(start, end, step["narration"], step["id"]))
        previous_end = end
    if not segments or previous_end >= 180:
        raise ValueError("The Challenge edit must be shorter than three minutes. Trim idle pauses and update the edit cues.")
    return segments


SEGMENTS = load_segments()


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def output(*args: str) -> str:
    return subprocess.check_output(args, text=True).strip()


def duration(path: Path) -> float:
    return float(output("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                        "default=noprint_wrappers=1:nokey=1", str(path)))


def save_pcm_wav(path: Path, pcm: bytes) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24_000)
        wav.writeframes(pcm)


def narration_prompt(segment: Segment) -> str:
    target = segment.end - segment.start - 0.5
    return f"""Audio profile:
A calm, warm product designer demonstrating a useful decision workspace as its user.

Scene:
A concise, evidence-led product demonstration for technical hackathon judges.

Director's notes:
Use confident, natural American English. Clear, conversational, and thoughtful, never theatrical or promotional.
Keep a steady pace with short pauses and restrained emphasis on evidence and human control.
Pronounce Ribband as RIB-band, WebMCP as Web M C P, Oahu as oh-AH-hoo, and JSON as jay-son.
Maintain the same neutral vocal register throughout. Do not add music, sound effects, filler, or commentary.
Read only the transcript. Aim for approximately {target:.1f} seconds with minimal dead air.

Transcript:
{segment.text}
"""


def segment_filename(index: int, segment: Segment) -> str:
    identity = "\n".join([MODEL, VOICE, narration_prompt(segment)])
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    return f"ribband-segment-{index:02d}-{digest}.wav"


def synthesize(client, segment: Segment, path: Path) -> None:
    from google.genai import types
    response = client.models.generate_content(
        model=MODEL, contents=narration_prompt(segment),
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)
            )),
        ),
    )
    candidates = response.candidates or []
    parts = candidates[0].content.parts if candidates and candidates[0].content else []
    audio = b"".join(part.inline_data.data for part in (parts or []) if part.inline_data and part.inline_data.data)
    if not audio:
        raise RuntimeError(f"Gemini returned no audio for {segment.id}")
    save_pcm_wav(path, audio)


def fit_audio(raw_duration: float, segment: Segment) -> tuple[float, float]:
    available = segment.end - segment.start - 0.5
    speed = max(0.85, raw_duration / available)
    if speed > 1.25:
        raise ValueError(f"Narration for {segment.id} needs {speed:.2f}x speed. Shorten its transcript or revise the edit cues.")
    return speed, max(0.0, available - raw_duration / speed)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, nargs="?", help="New silent Ribband recording, trimmed to the demo start")
    parser.add_argument("output", type=Path, nargs="?", help="New final video path; existing files are never overwritten")
    parser.add_argument("--audio-only", type=Path, help="Generate a standalone WAV and edit cues without a recording")
    parser.add_argument("--timing", type=Path, help="Exported edit cues; adjust if the visual edit removes pauses")
    parser.add_argument("--work-dir", type=Path, default=Path("build/demo-voiceover"))
    parser.add_argument("--project", help="Google Cloud project; defaults to the active gcloud project")
    parser.add_argument("--location", default="us-central1", help="Vertex AI location")
    args = parser.parse_args()
    if args.audio_only and (args.input or args.output):
        parser.error("Use either --audio-only or the input and output video paths.")
    if not args.audio_only and not (args.input and args.output):
        parser.error("Provide --audio-only PATH, or both recording and output paths.")

    segments = load_segments(timing_path=args.timing)
    source = args.input.expanduser().resolve() if args.input else None
    destination = (args.audio_only or args.output).expanduser().resolve()
    work_dir = args.work_dir.expanduser().resolve()
    cue_path = destination.with_suffix(".cues.json")
    if destination.exists() or cue_path.exists():
        raise SystemExit(f"Output or edit cues already exist; choose a new filename: {destination}")
    if source and not source.is_file():
        raise SystemExit(f"Recording not found: {source}")
    final_duration = duration(source) if source else segments[-1].end
    if final_duration >= 180 or final_duration + 0.1 < segments[-1].end:
        raise SystemExit("Recording must be under three minutes and cover every narration cue. Lock the edit and use --timing.")
    if args.audio_only and destination.suffix.lower() != ".wav":
        parser.error("The standalone audio output must use .wav.")
    work_dir.mkdir(parents=True, exist_ok=True)
    destination.parent.mkdir(parents=True, exist_ok=True)

    client = None
    inputs, filters, labels, report, timing_errors = [], [], [], [], []
    for index, segment in enumerate(segments, start=1):
        wav = work_dir / segment_filename(index, segment)
        if not wav.exists():
            if client is None:
                from google import genai
                from google.genai import types
                project = args.project or output("gcloud", "config", "get-value", "project")
                if not project or project == "(unset)":
                    raise SystemExit("No active Google Cloud project is configured")
                client = genai.Client(vertexai=True, project=project, location=args.location,
                                     http_options=types.HttpOptions(timeout=120_000))
            print(f"Synthesizing {index}/{len(segments)}: {segment.id}, {VOICE}", flush=True)
            synthesize(client, segment, wav)
        raw_duration = duration(wav)
        try:
            speed, silence = fit_audio(raw_duration, segment)
        except ValueError as error:
            timing_errors.append(str(error))
            print(f"  NEEDS RETIMING: {error}", flush=True)
            continue
        label = f"voice{index}"
        inputs.extend(["-i", str(wav)])
        filters.append(f"[{index - 1}:a]atempo={speed:.6f},adelay={int((segment.start + 0.2) * 1000)}:all=1[{label}]")
        labels.append(f"[{label}]")
        report.append({"id": segment.id, "start": segment.start, "end": segment.end, "text": segment.text,
                       "speed": round(speed, 4), "extraSilence": round(silence, 3)})
        print(f"  {raw_duration:.2f}s source, {speed:.3f}x playback, {silence:.2f}s extra pause", flush=True)

    if timing_errors:
        raise SystemExit("\n".join(timing_errors))
    voice_track = destination if args.audio_only else work_dir / f"{destination.stem}-voiceover.wav"
    if voice_track.exists():
        raise SystemExit(f"Voice mix already exists; choose a new output filename: {voice_track}")
    filters.append("".join(labels) + f"amix=inputs={len(labels)}:duration=longest:dropout_transition=0:normalize=0,"
                   f"apad=whole_dur={final_duration:.6f},atrim=duration={final_duration:.6f},"
                   "loudnorm=I=-16:TP=-1.5:LRA=7[voiceover]")
    run("ffmpeg", "-hide_banner", "-loglevel", "warning", "-n", *inputs, "-filter_complex", ";".join(filters),
        "-map", "[voiceover]", "-ar", "48000", "-c:a", "pcm_s16le", str(voice_track))
    if source:
        run("ffmpeg", "-hide_banner", "-loglevel", "warning", "-n", "-i", str(source), "-i", str(voice_track),
            "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart", "-t", f"{final_duration:.6f}", str(destination))
    with cue_path.open("x") as cue_file:
        json.dump({"title": "Ribband", "model": MODEL, "voice": VOICE, "duration": final_duration,
                   "timing": "measured edit cues" if args.timing else "nominal presenter timing", "cues": report}, cue_file, indent=2)
    print(f"Created {destination}\nEdit cues: {cue_path}")


if __name__ == "__main__":
    main()
