"""Assemble a fresh Ribband tab recording, measured cues, narration, and graphics."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def build_cuts(steps: list[dict], cues: list[dict]) -> list[dict]:
    if [step["id"] for step in steps] != [cue["id"] for cue in cues]:
        raise ValueError("Capture cue ids must match the complete current demo sequence.")
    cuts = []
    previous_end = 0.0
    for step, cue in zip(steps, cues):
        start, end = float(cue["start"]), float(cue["end"])
        target = float(step["duration"]) / 1000
        if not all(math.isfinite(value) for value in (start, end, target)) or start < previous_end or end <= start or target <= 0:
            raise ValueError("Capture cues must be finite, ordered, and non-overlapping.")
        # Remove an idle middle hold, preserving the opening transition and final click.
        if end - start > target + 1:
            ranges = [(start, start + 2), (end - (target - 2), end)]
        else:
            ranges = [(start, end)]
        kept = sum(right - left for left, right in ranges)
        cuts.append({"id": step["id"], "ranges": ranges, "duration": target, "timeScale": target / kept})
        previous_end = end
    if sum(cut["duration"] for cut in cuts) >= 180:
        raise ValueError("The final demo must be shorter than three minutes.")
    return cuts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recording", type=Path)
    parser.add_argument("cues", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--media-dir", type=Path, default=ROOT / "output/ribband-demo")
    args = parser.parse_args()
    destination = args.output.resolve()
    report_path = destination.with_suffix(".edit.json")
    if destination.exists() or report_path.exists():
        raise SystemExit("Choose an unused output filename. Existing edits are never overwritten.")
    sequence = json.loads((ROOT / "public/demo-sequence.json").read_text())
    capture = json.loads(args.cues.read_text())
    cuts = build_cuts(sequence["steps"], capture["cues"])
    duration = sum(cut["duration"] for cut in cuts)
    frames = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=pts_time,width,height", "-of", "json", str(args.recording)
    ], text=True))["frames"]
    active_frames = [frame for frame in frames if capture["cues"][0]["start"] <= float(frame["pts_time"]) < capture["cues"][-1]["end"]]
    sizes = {(frame["width"], frame["height"]) for frame in active_frames}
    if len(sizes) != 1:
        raise SystemExit("The recorded demonstration must have one stable viewport size after its lead-in.")
    width, height = sizes.pop()
    width, height = width // 2 * 2, height // 2 * 2
    ranges = [(index, left, right) for index, cut in enumerate(cuts) for left, right in cut["ranges"]]
    graph = [f"[0:v]split={len(ranges)}" + "".join(f"[raw{i}]" for i in range(len(ranges)))]
    groups = [[] for _ in cuts]
    for index, (cut_index, left, right) in enumerate(ranges):
        label = f"part{index}"
        graph.append(f"[raw{index}]trim=start={left:.6f}:end={right:.6f},setpts=PTS-STARTPTS[{label}]")
        groups[cut_index].append(f"[{label}]")
    for index, cut in enumerate(cuts):
        group = groups[index]
        source = group[0]
        if len(group) > 1:
            graph.append("".join(group) + f"concat=n={len(group)}:v=1:a=0[join{index}]")
            source = f"[join{index}]"
        graph.append(source + f"setpts={cut['timeScale']:.9f}*PTS,fps=30,scale={width}:{height},setsar=1[cut{index}]")
    graph.append("".join(f"[cut{i}]" for i in range(len(cuts))) + f"concat=n={len(cuts)}:v=1:a=0[edit]")
    graph.append("[edit]split=3[base][blur1][blur2]")
    overlay_width = round(width * 0.62 / 2) * 2
    last = "base"
    for index, (start, end) in enumerate([(54, 60), (82, 88)], start=1):
        enabled = f"between(t,{start},{end})"
        graph.append(f"[blur{index}]gblur=sigma=10:enable='{enabled}',format=yuva420p,fade=t=in:st={start}:d=0.2:alpha=1,fade=t=out:st={end - 0.2}:d=0.2:alpha=1[soft{index}]")
        graph.append(f"[{last}][soft{index}]overlay=enable='{enabled}'[background{index}]")
        graph.append(f"[{index + 1}:v]scale={overlay_width}:-2,format=rgba,fade=t=in:st={start}:d=0.2:alpha=1,fade=t=out:st={end - 0.2}:d=0.2:alpha=1[graphic{index}]")
        graph.append(f"[background{index}][graphic{index}]overlay=x=(W-w)/2:y=(H-h)/2:enable='{enabled}'[composite{index}]")
        last = f"composite{index}"
    graph.append(f"[{last}]format=yuv420p[final]")
    destination.parent.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "warning", "-nostats", "-n", "-i", str(args.recording), "-i", str(args.media_dir / "Ribband_Sadachbia_VO.wav")]
    for name in ["conversion", "authority"]:
        command.extend(["-loop", "1", "-framerate", "30", "-i", str(args.media_dir / f"Ribband_{name}.png")])
    command.extend(["-filter_complex_threads", "2", "-filter_complex", ";".join(graph), "-map", "[final]", "-map", "1:a:0",
                    "-c:v", "h264_videotoolbox", "-b:v", "18000k", "-maxrate", "24000k", "-bufsize", "32000k",
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", str(duration), "-movflags", "+faststart", str(destination)])
    print(f"Rendering {duration:g} seconds at {width} x {height} with {sequence['voice']} narration.", flush=True)
    subprocess.run(command, check=True)
    rendered = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(destination)
    ], text=True))
    if abs(float(rendered["format"]["duration"]) - duration) > 0.1:
        raise SystemExit("The render did not reach the full narration duration. Do not publish it.")
    with report_path.open("x") as handle:
        json.dump({"title": sequence["title"], "duration": duration, "resolution": [width, height],
                   "capture": str(args.recording.resolve()), "cuts": cuts,
                   "graphics": [{"name": "conversion", "start": 54, "end": 60}, {"name": "authority", "start": 82, "end": 88}],
                   "narration": {"model": sequence["model"], "voice": sequence["voice"]}}, handle, indent=2)
    print(f"Created {destination}\nEdit report: {report_path}")


if __name__ == "__main__":
    main()
