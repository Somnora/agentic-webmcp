# Ribband recording and narration guide

The updated presentation covers goods, source conversion, a human decision, services, and an Oahu activity itinerary in a nominal 2:45. The official Challenge video must be shorter than three minutes, with audio. Leave the remaining time for small interaction delays, not a separate introduction.

The presenter and voiceover share [demo-sequence.json](../public/demo-sequence.json). That file owns the order, tool arguments, full transcript, and nominal timing.

## Run the presentation

Use two Terminal tabs in the repository. The first starts the controlled origin:

```bash
cd /Users/jamesmcshane/APP_PROJECTS/Agentic/agentic-webmcp
npx wrangler dev --config wrangler.origin.jsonc --port 8788
```

The second starts the workspace:

```bash
cd /Users/jamesmcshane/APP_PROJECTS/Agentic/agentic-webmcp
npm run dev
```

Open `http://localhost:8787/?present=1` in the recording browser. Wait for the live origin status, confirm ten tools register in a WebMCP-capable browser, and click `Run guided demo`. Other browsers can run the manual actions but must not be presented as proof of agent registration.

This guided presentation invokes the real application actions; it is not an autonomous agent session. The overlay labels the actions and Worker behavior. It never silently clicks a human choice.

## Capture setup

- Capture at 2560 by 1440 or native HiDPI quality. Do not enlarge an old 720p recording and describe it as a new high-resolution capture.
- Keep the interface readable, the pointer visible, and browser chrome out of the composition where practical.
- Record without microphone audio. Add the prepared Sadachbia narration afterward.
- No countdown, total duration, or narration transcript appears in the presenter overlay.
- Do not show credentials, unrelated applications, third-party retail branding, or payment details.
- The marketplace and services directory contain original controlled fixtures served by real endpoints. Do not call them unrelated merchant inventory or confirmed provider availability.

## Edit cue sheet

Times are relative to the opening step, not the start of the screen recorder. Trim the recording lead-in. Network delays, Pause, Next, and late human responses change these times.

| Time | Visible evidence | Human action |
| --- | --- | --- |
| 0:00-0:09 | Ribband header and ten registered tools | Start the guided demo |
| 0:09-0:18 | `list_origins`, hostname and authorization | None |
| 0:18-0:26 | Controlled guitar marketplace | None |
| 0:26-0:43 | Gift request, taste, budget, uncertainty checkpoint | Read the choices and select `Safer returns` for this take |
| 0:43-0:51 | Ranked options and refinement effect | None |
| 0:51-1:11 | Canonical URL, Markdown, Offer, verification | None |
| 1:11-1:21 | Two source-grounded guitar finalists | None |
| 1:21-1:33 | Proposal and no-order/no-charge boundary | Read the quote, then click `Approve for handoff` |
| 1:33-1:41 | In-page decision receipt, not an order | None |
| 1:41-1:49 | Portable goods decision dossier | Click `Download dossier` before the source changes |
| 1:49-1:57 | Controlled services directory | None |
| 1:57-2:09 | Surf lesson scheduling and cancellation evidence | None |
| 2:09-2:33 | October 10 Oahu plan, two people, 450 USD total, 50 USD remaining | None |
| 2:33-2:45 | Planning limitations and itinerary dossier | Optionally download the second dossier |

Complete the three required human actions inside their displayed beat after reading the result. Early completion does not skip the remaining narration hold. If an action takes longer, the presentation waits safely. Next cannot bypass these gates. The goods dossier is downloaded before switching origins because decision context is origin-scoped.

After completion, click `Export edit cues`. The downloaded `ribband-demo-timing.json` contains measured step boundaries. If the edit removes pauses, update the cue times to match the edited video before regenerating narration. A QA rehearsal with long pauses is not a submission-ready take.

## Rebuild the measured video edit

The fresh browser capture and its recording-relative cues are retained locally. This command assembles all 14 beats, the prepared narration, and both graphics into a new file:

```bash
python3 scripts/render_demo_video.py \
  output/ribband-demo/Ribband_Clean_Capture.webm \
  output/ribband-demo/Ribband_Clean_Capture.json \
  output/ribband-demo/Ribband_Demo_Final_v2.mp4
```

This renderer uses macOS VideoToolbox through ffmpeg. It requires a stable capture viewport after the lead-in and preserves that native aspect ratio. It trims idle middle holds while retaining the opening transition and final action in each beat, then fits the picture to the nominal narration timeline. It does not fabricate an approval or a download. The adjacent `.edit.json` records the exact source ranges, output dimensions, and graphic placement. Existing output files are never overwritten.

For another recording, cues must refer to the recording's timestamps. The app's exported cues start at the guided presentation, so either trim the recorder lead-in first or offset every cue by the lead-in duration. Review any removed holds before publishing.

## Current voiceover

The generated master is `output/ribband-demo/Ribband_Sadachbia_VO.wav`; the listening copy is `output/ribband-demo/Ribband_Sadachbia_Preview.mp3`. It uses `gemini-3.1-flash-tts-preview`, voice `Sadachbia`, with a calm first-person explanation. Pronounce Ribband as `RIB-band`.

The current track lasts 165 seconds. It is synchronized to the measured 14-beat edit in `output/ribband-demo/Ribband_Demo_Final.mp4`. The adjacent `.cues.json` contains the full transcript and segment fit factors. The clean source recording, recording-relative cues, exact edit report, and final MP4 remain local and are ignored by Git. Do not put this track over the old Agentic recording, which has different branding and no services itinerary.

For a fresh standalone track, choose an unused output filename:

```bash
python3 scripts/render_demo_voiceover.py \
  --audio-only output/ribband-demo/Ribband_Sadachbia_VO_v2.wav \
  --work-dir output/ribband-demo/voice-cache
```

Add `--timing` followed by the actual exported or edited JSON path for measured cues. To add narration to a new silent recording, pass the recording path and a new output video path as the two positional arguments instead of `--audio-only`. Use real file paths, not `/absolute/path/to/recording.mov`. Run `python3 scripts/render_demo_voiceover.py --help` for details.

Generation requires Python with `google-genai`, ffmpeg/ffprobe, and an authorized Google Cloud Vertex AI project. The script defaults to the active gcloud project and `us-central1`. It never prints or commits credentials. Unchanged segments reuse a cache keyed by transcript, direction, duration, model, and voice. It refuses existing output files, overlapping cues, a three-minute-or-longer edit, or segments requiring more than 1.25x playback.

## Picture-in-picture graphics

Editable vectors are in `docs/assets`; transparent-edge 2400 by 1040 PNG exports are in `output/ribband-demo`. They have no excess white border.

| Nominal placement | Asset | Treatment |
| --- | --- | --- |
| 0:54-1:00 | `Ribband_conversion.png` | Source to Offer/Markdown to shared tools. Restore the unobscured verification view afterward. |
| 1:22-1:28 | `Ribband_authority.png` | Agent versus person. Remove before the approval click and receipt. |

Use a restrained 6-frame dissolve in and out. At 1440p, display at roughly 55 to 60 percent of frame width. Apply background blur only for the graphic's duration. Do not leave canonical sources, approval, or the itinerary covered. Move graphics with their beats if the edit changes.

## Final picture review

1. Confirm the title, interface, narration, and end frame say Ribband.
2. Confirm ten tools really register in the recording browser; the guided runner is not proof of an autonomous client.
3. Watch the entire edit with sound. Check pronunciation, pace, click alignment, smooth focus movement, and no cursor jump.
4. Keep source fixture labels visible. Oahu times are proposals, transition buffers are assumptions, and no provider is contacted.
5. Verify the final export is under three minutes, with readable image quality and an audio track.
6. Only then upload the approved video and update the submission link. Local edits do not update the public Worker, YouTube, or Devpost.

The current local export passed frame review at 14 representative timestamps, full decode validation, and stream inspection: 2:45, 3674 by 1804, 30 fps H.264, and 48 kHz mono AAC. Automated audio checks found about -16.9 LUFS integrated loudness, -1.5 dBFS true peak, and no silence longer than 1.5 seconds at a -40 dB threshold. James still needs to watch the complete export with sound before publication.
