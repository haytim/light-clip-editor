import { app, BrowserWindow, dialog, ipcMain, Notification, type OpenDialogOptions, type SaveDialogOptions } from "electron";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, stat, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

type CompressRequest = {
  inputPath: string;
  outputPath: string;
  targetSizeMB: number;
  preset: "ultrafast" | "fast" | "medium" | "slow";
};

type MergeRequest = {
  inputPaths: string[];
  outputPath: string;
  mode: "stream-copy" | "universal";
};

type VolumeRequest = {
  inputPath: string;
  outputPath: string;
  volumeDb: number;
};

type CropRequest = {
  inputPath: string;
  outputPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ToMp3Request = {
  inputPath: string;
  outputPath: string;
  bitrateKbps: number;
};

type CutRequest = {
  inputPath: string;
  outputPath: string;
  startTime: string;
  endTime: string;
  mode: "lossless" | "reencode";
};

type PreviewRequest = {
  inputPath: string;
};

type PreviewProfile = {
  id: string;
  extension: "mp4" | "webm";
  args: string[];
};

type ProgressUpdate = {
  operation: string;
  progress: number;
};

type DurationCacheEntry = {
  fingerprint: string;
  duration: number;
};

type PreviewCacheEntry = {
  previewPath: string;
  createdAt: number;
};

let mainWindow: BrowserWindow | null = null;
let clearProgressTimer: NodeJS.Timeout | null = null;

const ffmpegPath = ffmpegStatic || "ffmpeg";
let selectedH264Encoder: "libx264" | "h264_nvenc" | "h264_qsv" | "h264_amf" = "libx264";
let selectedHwAccel: "cuda" | "qsv" | "d3d11va" | "dxva2" | null = null;
const durationCache = new Map<string, DurationCacheEntry>();
const previewCache = new Map<string, PreviewCacheEntry>();
const maxPreviewCacheEntries = 24;

function shouldStartMinimized() {
  return process.argv.includes("--start-minimized") || process.env.START_MINIMIZED === "1";
}

function normalizeOperationName(operation: string) {
  return operation.replace(/-(gpu|cpu)$/, "");
}

function shouldNotifyOperation(operation: string) {
  const normalized = normalizeOperationName(operation);
  return normalized === "compress" ||
    normalized === "merge-fast" ||
    normalized === "merge-universal" ||
    normalized === "crop" ||
    normalized === "volume" ||
    normalized === "to-mp3" ||
    normalized === "cut-lossless" ||
    normalized === "cut-reencode";
}

function operationLabel(operation: string) {
  const normalized = normalizeOperationName(operation);
  if (normalized === "compress") return "Compression";
  if (normalized === "merge-fast" || normalized === "merge-universal") return "Merge";
  if (normalized === "crop") return "Crop";
  if (normalized === "volume") return "Audio Boost";
  if (normalized === "to-mp3") return "MP4 to MP3";
  if (normalized === "cut-lossless" || normalized === "cut-reencode") return "Cut";
  return normalized.replace(/-/g, " ");
}

function notifyWhenBackgrounded(title: string, body: string) {
  if (!Notification.isSupported()) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused()) return;

  new Notification({
    title,
    body,
    silent: true,
  }).show();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 690,
    minWidth: 780,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;

    mainWindow.show();
    if (shouldStartMinimized()) {
      mainWindow.minimize();
      sendLog("[startup] Window started minimized (--start-minimized or START_MINIMIZED=1).");
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("ffmpeg-log", `App ready. Using FFmpeg: ${ffmpegPath}`);
  });

  mainWindow.loadFile(path.join(__dirname, "../src/renderer/index.html"));
}

function sendProgress(update: ProgressUpdate) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const safeProgress = Math.max(0, Math.min(100, Math.round(update.progress)));
  mainWindow.webContents.send("ffmpeg-progress", { operation: update.operation, progress: safeProgress });

  if (clearProgressTimer) {
    clearTimeout(clearProgressTimer);
    clearProgressTimer = null;
  }

  if (safeProgress >= 100) {
    mainWindow.setProgressBar(1, { mode: "normal" });
    clearProgressTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.setProgressBar(-1);
      clearProgressTimer = null;
    }, 1100);
    return;
  }

  mainWindow.setProgressBar(safeProgress / 100, { mode: "normal" });
}

function sendLog(message: string) {
  mainWindow?.webContents.send("ffmpeg-log", message);
}

async function getFileFingerprint(filePath: string): Promise<string> {
  const metadata = await stat(filePath);
  return `${filePath}|${metadata.size}|${Math.floor(metadata.mtimeMs)}`;
}

function parseTimecodeToSeconds(timecode: string): number | null {
  const parts = timecode.split(":");
  if (parts.length !== 3) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;

  return hours * 3600 + minutes * 60 + seconds;
}

function extractLatestFfmpegTimeSeconds(text: string): number | null {
  const matches = text.match(/time=\s*([0-9:.]+)/g);
  if (!matches || matches.length === 0) return null;

  const latest = matches[matches.length - 1].replace("time=", "").trim();
  return parseTimecodeToSeconds(latest);
}

function runCommandCapture(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

async function detectAccelerationCapabilities() {
  try {
    const encoders = await runCommandCapture(["-hide_banner", "-encoders"]);
    const encoderText = `${encoders.stdout}\n${encoders.stderr}`;

    if (/\bh264_nvenc\b/.test(encoderText)) {
      selectedH264Encoder = "h264_nvenc";
    } else if (/\bh264_qsv\b/.test(encoderText)) {
      selectedH264Encoder = "h264_qsv";
    } else if (/\bh264_amf\b/.test(encoderText)) {
      selectedH264Encoder = "h264_amf";
    } else {
      selectedH264Encoder = "libx264";
    }

    const hwaccels = await runCommandCapture(["-hide_banner", "-hwaccels"]);
    const hwText = `${hwaccels.stdout}\n${hwaccels.stderr}`;

    if (/\bcuda\b/.test(hwText)) {
      selectedHwAccel = "cuda";
    } else if (/\bqsv\b/.test(hwText)) {
      selectedHwAccel = "qsv";
    } else if (/\bd3d11va\b/.test(hwText)) {
      selectedHwAccel = "d3d11va";
    } else if (/\bdxva2\b/.test(hwText)) {
      selectedHwAccel = "dxva2";
    } else {
      selectedHwAccel = null;
    }

    sendLog(`[startup] H264 encoder: ${selectedH264Encoder}, hwaccel: ${selectedHwAccel ?? "none"}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    sendLog(`[startup] GPU detection failed: ${msg}`);
  }
}

function mapPresetForEncoder(preset: CompressRequest["preset"]) {
  if (selectedH264Encoder === "h264_nvenc") {
    if (preset === "ultrafast") return "p1";
    if (preset === "fast") return "p3";
    if (preset === "medium") return "p5";
    return "p7";
  }

  return preset;
}

function getPresetArgs(preset: CompressRequest["preset"]): string[] {
  if (selectedH264Encoder === "h264_qsv" || selectedH264Encoder === "h264_amf") {
    return [];
  }
  return ["-preset", mapPresetForEncoder(preset)];
}

function runFfmpeg(args: string[], operation: string, durationSeconds?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ["-y", ...args], {
      windowsHide: true,
    });

    sendProgress({ operation, progress: 0 });
    let bufferedStderr = "";
    let lastProgressValue = -1;
    let lastProgressLineAt = 0;

    const handleLogLine = (rawLine: string) => {
      const line = rawLine.trimEnd();
      if (!line) return;

      const isFrequentProgressLine = /frame=|fps=|size=|speed=|time=/.test(line);
      if (isFrequentProgressLine) {
        const now = Date.now();
        if (now - lastProgressLineAt < 180) return;
        lastProgressLineAt = now;
      }

      sendLog(`[${operation}] ${line}`);

      if (durationSeconds && durationSeconds > 0) {
        const elapsedSeconds = extractLatestFfmpegTimeSeconds(line);
        if (elapsedSeconds != null) {
          const progress = Math.max(0, Math.min(99, Math.round((elapsedSeconds / durationSeconds) * 100)));
          if (progress !== lastProgressValue) {
            lastProgressValue = progress;
            sendProgress({ operation, progress });
          }
        }
      }
    };

    child.stderr.on("data", (chunk) => {
      bufferedStderr += chunk.toString();
      const lines = bufferedStderr.split(/\r?\n/);
      bufferedStderr = lines.pop() ?? "";
      for (const line of lines) {
        handleLogLine(line);
      }
    });

    child.on("error", (error) => {
      if (shouldNotifyOperation(operation)) {
        notifyWhenBackgrounded("Light Video Editor", `${operationLabel(operation)} failed to start.`);
      }
      reject(new Error(`${operation} failed to start: ${error.message}`));
    });

    child.on("close", (code) => {
      if (bufferedStderr.trim()) {
        handleLogLine(bufferedStderr);
      }

      if (code === 0) {
        sendProgress({ operation, progress: 100 });
        if (shouldNotifyOperation(operation)) {
          notifyWhenBackgrounded("Light Video Editor", `${operationLabel(operation)} completed.`);
        }
        resolve();
        return;
      }

      if (shouldNotifyOperation(operation)) {
        notifyWhenBackgrounded("Light Video Editor", `${operationLabel(operation)} failed. Check Activity logs.`);
      }

      reject(new Error(`${operation} failed with exit code ${code}`));
    });
  });
}

async function runFfmpegWithFallback(
  args: string[],
  operation: string,
  durationSeconds?: number,
  useHwAccel = true
) {
  const shouldUseHwAccel = selectedHwAccel != null;

  if (!shouldUseHwAccel || !useHwAccel) {
    await runFfmpeg(args, operation, durationSeconds);
    return;
  }

  try {
    await runFfmpeg(["-hwaccel", selectedHwAccel!, ...args], `${operation}-gpu`, durationSeconds);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    sendLog(`[${operation}] GPU path failed (${msg}). Falling back to software path.`);
    await runFfmpeg(args, `${operation}-cpu`, durationSeconds);
  }
}

function cleanupPreviewCache() {
  if (previewCache.size <= maxPreviewCacheEntries) return;

  const ordered = Array.from(previewCache.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
  const toRemove = ordered.slice(0, Math.max(0, previewCache.size - maxPreviewCacheEntries));
  toRemove.forEach(([fingerprint, entry]) => {
    previewCache.delete(fingerprint);
    void rm(entry.previewPath, { force: true }).catch(() => undefined);
  });
}

async function generateCompatiblePreview(inputPath: string, durationSeconds?: number): Promise<string> {
  const profiles: PreviewProfile[] = [
    {
      id: "h264",
      extension: "mp4",
      args: [
        "-i",
        inputPath,
        "-fflags",
        "+genpts",
        "-fps_mode:v",
        "vfr",
        "-vf",
        "scale=1280:-2:force_original_aspect_ratio=decrease,fps=30",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
        "-t",
        "120",
      ],
    },
    {
      id: "mpeg4",
      extension: "mp4",
      args: [
        "-i",
        inputPath,
        "-fflags",
        "+genpts",
        "-fps_mode:v",
        "vfr",
        "-vf",
        "scale=1280:-2:force_original_aspect_ratio=decrease,fps=30",
        "-c:v",
        "mpeg4",
        "-q:v",
        "8",
        "-pix_fmt",
        "yuv420p",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
        "-t",
        "120",
      ],
    },
    {
      id: "vp8",
      extension: "webm",
      args: [
        "-i",
        inputPath,
        "-fflags",
        "+genpts",
        "-fps_mode:v",
        "vfr",
        "-vf",
        "scale=1280:-2:force_original_aspect_ratio=decrease,fps=30",
        "-c:v",
        "libvpx",
        "-deadline",
        "realtime",
        "-cpu-used",
        "8",
        "-b:v",
        "0",
        "-crf",
        "32",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:a",
        "libopus",
        "-b:a",
        "96k",
        "-ac",
        "2",
        "-ar",
        "48000",
        "-t",
        "120",
      ],
    },
    {
      id: "vp9",
      extension: "webm",
      args: [
        "-i",
        inputPath,
        "-fflags",
        "+genpts",
        "-fps_mode:v",
        "vfr",
        "-vf",
        "scale=1280:-2:force_original_aspect_ratio=decrease,fps=30",
        "-c:v",
        "libvpx-vp9",
        "-deadline",
        "realtime",
        "-cpu-used",
        "6",
        "-row-mt",
        "1",
        "-b:v",
        "0",
        "-crf",
        "36",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:a",
        "libopus",
        "-b:a",
        "96k",
        "-ac",
        "2",
        "-ar",
        "48000",
        "-t",
        "120",
      ],
    },
  ];

  let lastError: unknown;

  for (const profile of profiles) {
    const previewPath = path.join(os.tmpdir(), `llv-preview-${profile.id}-${randomUUID()}.${profile.extension}`);

    try {
      await runFfmpeg([...profile.args, previewPath], `preview-${profile.id}`, durationSeconds);
      sendLog(`[preview] Using profile: ${profile.id}`);
      return previewPath;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      sendLog(`[preview] Profile ${profile.id} failed: ${msg}`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All preview profiles failed");
}

function parseDurationSeconds(text: string): number | null {
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;

  return hours * 3600 + minutes * 60 + seconds;
}

async function probeDurationSeconds(inputPath: string): Promise<number> {
  const fingerprint = await getFileFingerprint(inputPath);
  const cached = durationCache.get(inputPath);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.duration;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ["-i", inputPath], {
      windowsHide: true,
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Could not read media info: ${error.message}`));
    });

    child.on("close", () => {
      const duration = parseDurationSeconds(stderr);
      if (!duration || duration <= 0) {
        reject(new Error("Could not detect video duration for compression."));
        return;
      }

      durationCache.set(inputPath, { fingerprint, duration });
      resolve(duration);
    });
  });
}

ipcMain.handle("dialog:pickSingleInput", async () => {
  const options: OpenDialogOptions = {
    title: "Select video file",
    properties: ["openFile"],
    filters: [
      { name: "Video", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "ts"] },
      { name: "All Files", extensions: ["*"] },
    ],
  };

  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("dialog:pickOutput", async (_event, suggestedName: string) => {
  const extension = path.extname(suggestedName).toLowerCase();
  const filters = extension === ".mp3"
    ? [{ name: "MP3", extensions: ["mp3"] }]
    : [{ name: "MP4", extensions: ["mp4"] }];

  const options: SaveDialogOptions = {
    title: "Choose output file",
    defaultPath: path.join(app.getPath("videos"), suggestedName),
    filters,
  };

  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle("video:compress", async (_event, payload: CompressRequest) => {
  const { inputPath, outputPath, targetSizeMB, preset } = payload;

  const durationSeconds = await probeDurationSeconds(inputPath);
  const safeTargetMb = Math.max(1, targetSizeMB);
  const adjustedTargetBits = safeTargetMb * 1024 * 1024 * 8 * 0.94;
  const audioBitrateKbps = 96;
  const totalBitrateKbps = Math.floor(adjustedTargetBits / durationSeconds / 1000);
  const videoBitrateKbps = Math.max(220, totalBitrateKbps - audioBitrateKbps);

  mainWindow?.webContents.send(
    "ffmpeg-log",
    `[compress] Target ${safeTargetMb.toFixed(2)}MB, duration ${durationSeconds.toFixed(2)}s, video bitrate ${videoBitrateKbps}k`
  );

  await runFfmpegWithFallback(
    [
      "-i",
      inputPath,
      "-c:v",
      selectedH264Encoder,
      ...getPresetArgs(preset),
      "-b:v",
      `${videoBitrateKbps}k`,
      "-maxrate",
      `${Math.floor(videoBitrateKbps * 1.15)}k`,
      "-bufsize",
      `${Math.floor(videoBitrateKbps * 2)}k`,
      "-c:a",
      "aac",
      "-b:a",
      `${audioBitrateKbps}k`,
      outputPath,
    ],
    "compress",
    durationSeconds
  );

  return { success: true };
});

ipcMain.handle("video:toMp3", async (_event, payload: ToMp3Request) => {
  const { inputPath, outputPath, bitrateKbps } = payload;
  const durationSeconds = await probeDurationSeconds(inputPath).catch(() => undefined);
  const safeBitrate = Math.max(64, Math.min(320, Math.round(bitrateKbps)));

  await runFfmpegWithFallback(
    [
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      `${safeBitrate}k`,
      outputPath,
    ],
    "to-mp3",
    durationSeconds,
    false
  );

  return { success: true };
});

ipcMain.handle("video:merge", async (_event, payload: MergeRequest) => {
  const { inputPaths, outputPath, mode } = payload;
  const inputDurations = await Promise.all(
    inputPaths.map((inputPath) => probeDurationSeconds(inputPath).catch(() => 0))
  );
  const totalDuration = inputDurations.reduce((acc, cur) => acc + cur, 0);

  if (inputPaths.length < 2) {
    throw new Error("Please select at least two videos to merge.");
  }

  if (mode === "stream-copy") {
    const listFilePath = path.join(os.tmpdir(), `merge-list-${randomUUID()}.txt`);
    const concatBody = inputPaths
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");

    await writeFile(listFilePath, concatBody, "utf-8");

    try {
      await runFfmpegWithFallback(
        ["-f", "concat", "-safe", "0", "-i", listFilePath, "-c", "copy", outputPath],
        "merge-fast",
        totalDuration > 0 ? totalDuration : undefined,
        false
      );
    } finally {
      await unlink(listFilePath).catch(() => undefined);
    }

    return { success: true };
  }

  const mergeWorkDir = await mkdtemp(path.join(os.tmpdir(), "llv-merge-"));
  const normalizedPaths: string[] = [];

  try {
    for (let i = 0; i < inputPaths.length; i += 1) {
      const inputPath = inputPaths[i];
      const normalizedPath = path.join(mergeWorkDir, `normalized-${i}.mp4`);
      normalizedPaths.push(normalizedPath);

      await runFfmpegWithFallback(
        [
          "-i",
          inputPath,
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2",
          "-c:v",
          selectedH264Encoder,
          ...getPresetArgs("medium"),
          "-b:v",
          "2500k",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-ac",
          "2",
          normalizedPath,
        ],
        `merge-normalize-${i + 1}`,
        inputDurations[i] > 0 ? inputDurations[i] : undefined
      );
    }

    const listFilePath = path.join(mergeWorkDir, "merge-list.txt");
    const concatBody = normalizedPaths
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");

    await writeFile(listFilePath, concatBody, "utf-8");

    await runFfmpegWithFallback(
      [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFilePath,
        "-c:v",
        selectedH264Encoder,
        ...getPresetArgs("medium"),
        "-b:v",
        "3000k",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        outputPath,
      ],
      "merge-universal",
      totalDuration > 0 ? totalDuration : undefined
    );
  } finally {
    await rm(mergeWorkDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return { success: true };
});

ipcMain.handle("video:crop", async (_event, payload: CropRequest) => {
  const { inputPath, outputPath, x, y, width, height } = payload;
  const durationSeconds = await probeDurationSeconds(inputPath).catch(() => undefined);

  const safeX = Math.max(0, Math.round(x));
  const safeY = Math.max(0, Math.round(y));
  const safeWidth = Math.max(2, Math.round(width));
  const safeHeight = Math.max(2, Math.round(height));

  await runFfmpegWithFallback(
    [
      "-i",
      inputPath,
      "-vf",
      `crop=${safeWidth}:${safeHeight}:${safeX}:${safeY},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      "-c:v",
      selectedH264Encoder,
      ...getPresetArgs("medium"),
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath,
    ],
    "crop",
    durationSeconds
  );

  return { success: true };
});

ipcMain.handle("video:adjustVolume", async (_event, payload: VolumeRequest) => {
  const { inputPath, outputPath, volumeDb } = payload;
  const durationSeconds = await probeDurationSeconds(inputPath).catch(() => undefined);

  await runFfmpegWithFallback(
    [
      "-i",
      inputPath,
      "-c:v",
      "copy",
      "-af",
      `volume=${volumeDb}dB`,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath,
    ],
    "volume",
    durationSeconds
  );

  return { success: true };
});

ipcMain.handle("video:cut", async (_event, payload: CutRequest) => {
  const { inputPath, outputPath, startTime, endTime, mode } = payload;
  const sourceDurationSeconds = await probeDurationSeconds(inputPath).catch(() => undefined);

  if (!startTime || !endTime) {
    throw new Error("Start and end times are required.");
  }

  if (mode === "lossless") {
    await runFfmpegWithFallback(
      ["-ss", startTime, "-to", endTime, "-i", inputPath, "-c", "copy", outputPath],
      "cut-lossless",
      sourceDurationSeconds,
      false
    );
  } else {
    await runFfmpegWithFallback(
      [
        "-ss",
        startTime,
        "-to",
        endTime,
        "-i",
        inputPath,
        "-c:v",
        selectedH264Encoder,
        ...getPresetArgs("medium"),
        "-b:v",
        "4000k",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        outputPath,
      ],
      "cut-reencode",
      sourceDurationSeconds
    );
  }

  return { success: true };
});

ipcMain.handle("video:createPreview", async (_event, payload: PreviewRequest) => {
  const { inputPath } = payload;
  const durationSeconds = await probeDurationSeconds(inputPath).catch(() => undefined);

  const fingerprint = await getFileFingerprint(inputPath).catch(() => undefined);
  if (fingerprint) {
    const cached = previewCache.get(fingerprint);
    if (cached && existsSync(cached.previewPath)) {
      sendLog("[preview] cache hit");
      return { previewPath: cached.previewPath };
    }
  }

  const previewPath = await generateCompatiblePreview(inputPath, durationSeconds);
  if (fingerprint) {
    previewCache.set(fingerprint, { previewPath, createdAt: Date.now() });
    cleanupPreviewCache();
  }
  return { previewPath };
});

app.whenReady().then(async () => {
  createWindow();
  await detectAccelerationCapabilities();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
