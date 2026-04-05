# Light Video Editor

Super lightweight desktop app in TypeScript + Electron with the following features:

- Video cutting (LosslessCut-style)
- Video compression by target file size
- Video merging
- Video cropping with interactive selection
- Audio gain adjustment in dB
- MP4 to MP3 conversion

It uses `ffmpeg-static`, so FFmpeg is bundled as an npm dependency.

## Quick Start

```bash
npm install
npm run start
```

To launch minimized (useful when running jobs in the background):

```bash
npm run start -- --start-minimized
```

## Build Only

```bash
npm run build
```

## Notes

- Cut supports two modes:
	- `Lossless` for very fast keyframe-based trimming
	- `Re-encode` for frame-accurate trimming
- The Cut tab includes video preview and lets you set start/end from the current playhead.
- Merge supports two modes:
	- `Universal` (default) re-encodes inputs first so different formats can be merged more reliably
	- `Fast copy` uses stream copy and requires matching input stream parameters
- Crop includes a draggable/resizeable selection box with direct `x/y/width/height` pixel controls.
- Compression defaults to target `9.8 MB` (just under 10 MB), outputs H.264 + AAC in MP4.
- Audio gain uses decibel values (for example `+6 dB`) and re-encodes audio.
- MP4 to MP3 conversion uses `libmp3lame` with selectable bitrate (`128` to `320` kbps).
- If file dialogs fail on your system, you can paste full input/output paths manually in the app fields.

Mostly vibe-coded by me (tim), not for commercial use

## Maintenance

- The app is optimized for low-overhead UI updates during crop drag/resize by deferring heavy sync work until pointer release.
- Unused renderer/preload APIs and stale UI remnants have been removed to keep the code path lean.