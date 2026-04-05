import { contextBridge, ipcRenderer } from "electron";

type CompressPayload = {
  inputPath: string;
  outputPath: string;
  targetSizeMB: number;
  preset: "ultrafast" | "fast" | "medium" | "slow";
};

type MergePayload = {
  inputPaths: string[];
  outputPath: string;
  mode: "stream-copy" | "universal";
};

type VolumePayload = {
  inputPath: string;
  outputPath: string;
  volumeDb: number;
};

type CropPayload = {
  inputPath: string;
  outputPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ToMp3Payload = {
  inputPath: string;
  outputPath: string;
  bitrateKbps: number;
};

type CutPayload = {
  inputPath: string;
  outputPath: string;
  startTime: string;
  endTime: string;
  mode: "lossless" | "reencode";
};

type PreviewPayload = {
  inputPath: string;
};

contextBridge.exposeInMainWorld("videoApi", {
  pickSingleInput: () => ipcRenderer.invoke("dialog:pickSingleInput") as Promise<string | null>,
  pickOutput: (suggestedName: string) => ipcRenderer.invoke("dialog:pickOutput", suggestedName) as Promise<string | null>,
  compress: (payload: CompressPayload) => ipcRenderer.invoke("video:compress", payload) as Promise<{ success: true }>,
  merge: (payload: MergePayload) => ipcRenderer.invoke("video:merge", payload) as Promise<{ success: true }>,
  crop: (payload: CropPayload) => ipcRenderer.invoke("video:crop", payload) as Promise<{ success: true }>,
  adjustVolume: (payload: VolumePayload) => ipcRenderer.invoke("video:adjustVolume", payload) as Promise<{ success: true }>,
  toMp3: (payload: ToMp3Payload) => ipcRenderer.invoke("video:toMp3", payload) as Promise<{ success: true }>,
  cut: (payload: CutPayload) => ipcRenderer.invoke("video:cut", payload) as Promise<{ success: true }>,
  createPreview: (payload: PreviewPayload) => ipcRenderer.invoke("video:createPreview", payload) as Promise<{ previewPath: string }>,
  onProgress: (handler: (payload: { operation: string; progress: number }) => void) => {
    const listener = (_event: unknown, payload: { operation: string; progress: number }) =>
      handler(payload);
    ipcRenderer.on("ffmpeg-progress", listener);

    return () => {
      ipcRenderer.removeListener("ffmpeg-progress", listener);
    };
  },
  onLog: (handler: (line: string) => void) => {
    const listener = (_event: unknown, line: string) => handler(line);
    ipcRenderer.on("ffmpeg-log", listener);

    return () => {
      ipcRenderer.removeListener("ffmpeg-log", listener);
    };
  },
});
