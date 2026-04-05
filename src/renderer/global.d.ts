export {};

declare global {
  interface Window {
    videoApi: {
      pickSingleInput: () => Promise<string | null>;
      pickOutput: (suggestedName: string) => Promise<string | null>;
      compress: (payload: {
        inputPath: string;
        outputPath: string;
        targetSizeMB: number;
        preset: "ultrafast" | "fast" | "medium" | "slow";
      }) => Promise<{ success: true }>;
      merge: (payload: {
        inputPaths: string[];
        outputPath: string;
        mode: "stream-copy" | "universal";
      }) => Promise<{ success: true }>;
      crop: (payload: {
        inputPath: string;
        outputPath: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }) => Promise<{ success: true }>;
      adjustVolume: (payload: {
        inputPath: string;
        outputPath: string;
        volumeDb: number;
      }) => Promise<{ success: true }>;
      toMp3: (payload: {
        inputPath: string;
        outputPath: string;
        bitrateKbps: number;
      }) => Promise<{ success: true }>;
      cut: (payload: {
        inputPath: string;
        outputPath: string;
        startTime: string;
        endTime: string;
        mode: "lossless" | "reencode";
      }) => Promise<{ success: true }>;
      createPreview: (payload: {
        inputPath: string;
      }) => Promise<{ previewPath: string }>;
      onProgress: (handler: (payload: { operation: string; progress: number }) => void) => () => void;
      onLog: (handler: (line: string) => void) => () => void;
    };
  }
}
