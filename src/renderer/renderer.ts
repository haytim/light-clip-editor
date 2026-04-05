type Api = Window["videoApi"];
type NativeFile = File & { path?: string };
type CropInteractionMode = "none" | "create" | "move" | "resize";

const api = (window as Window & { videoApi?: Api }).videoApi;

const el = {
  nativeSinglePicker: document.getElementById("nativeSinglePicker") as HTMLInputElement,
  allButtons: Array.from(document.querySelectorAll("button")) as HTMLButtonElement[],

  taskStatusText: document.getElementById("taskStatusText") as HTMLSpanElement,
  taskPercentText: document.getElementById("taskPercentText") as HTMLSpanElement,
  taskProgressBar: document.getElementById("taskProgressBar") as HTMLProgressElement,

  tabButtons: Array.from(document.querySelectorAll(".tab-btn")) as HTMLButtonElement[],
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")) as HTMLElement[],

  cutInputBtn: document.getElementById("cutInputBtn") as HTMLButtonElement,
  cutInputManual: document.getElementById("cutInputManual") as HTMLInputElement,
  cutOutputBtn: document.getElementById("cutOutputBtn") as HTMLButtonElement,
  cutOutputManual: document.getElementById("cutOutputManual") as HTMLInputElement,
  previewVideo: document.getElementById("previewVideo") as HTMLVideoElement,
  currentTimeText: document.getElementById("currentTimeText") as HTMLSpanElement,
  previewStatusText: document.getElementById("previewStatusText") as HTMLSpanElement,
  setStartFromCurrentBtn: document.getElementById("setStartFromCurrentBtn") as HTMLButtonElement,
  setEndFromCurrentBtn: document.getElementById("setEndFromCurrentBtn") as HTMLButtonElement,
  cutStartInput: document.getElementById("cutStartInput") as HTMLInputElement,
  cutEndInput: document.getElementById("cutEndInput") as HTMLInputElement,
  cutModeInput: document.getElementById("cutModeInput") as HTMLSelectElement,
  cutRunBtn: document.getElementById("cutRunBtn") as HTMLButtonElement,

  compressInputBtn: document.getElementById("compressInputBtn") as HTMLButtonElement,
  compressInputManual: document.getElementById("compressInputManual") as HTMLInputElement,
  compressOutputBtn: document.getElementById("compressOutputBtn") as HTMLButtonElement,
  compressOutputManual: document.getElementById("compressOutputManual") as HTMLInputElement,
  targetSizeInput: document.getElementById("targetSizeInput") as HTMLInputElement,
  presetInput: document.getElementById("presetInput") as HTMLSelectElement,
  compressRunBtn: document.getElementById("compressRunBtn") as HTMLButtonElement,

  mergeCountInput: document.getElementById("mergeCountInput") as HTMLSelectElement,
  mergeSlots: Array.from(document.querySelectorAll(".merge-slot")) as HTMLElement[],
  mergeInput1Btn: document.getElementById("mergeInput1Btn") as HTMLButtonElement,
  mergeInput2Btn: document.getElementById("mergeInput2Btn") as HTMLButtonElement,
  mergeInput3Btn: document.getElementById("mergeInput3Btn") as HTMLButtonElement,
  mergeInput4Btn: document.getElementById("mergeInput4Btn") as HTMLButtonElement,
  mergeInput5Btn: document.getElementById("mergeInput5Btn") as HTMLButtonElement,
  mergeInput6Btn: document.getElementById("mergeInput6Btn") as HTMLButtonElement,
  mergeInput1Manual: document.getElementById("mergeInput1Manual") as HTMLInputElement,
  mergeInput2Manual: document.getElementById("mergeInput2Manual") as HTMLInputElement,
  mergeInput3Manual: document.getElementById("mergeInput3Manual") as HTMLInputElement,
  mergeInput4Manual: document.getElementById("mergeInput4Manual") as HTMLInputElement,
  mergeInput5Manual: document.getElementById("mergeInput5Manual") as HTMLInputElement,
  mergeInput6Manual: document.getElementById("mergeInput6Manual") as HTMLInputElement,
  mergeOutputBtn: document.getElementById("mergeOutputBtn") as HTMLButtonElement,
  mergeOutputManual: document.getElementById("mergeOutputManual") as HTMLInputElement,
  mergeModeInput: document.getElementById("mergeModeInput") as HTMLSelectElement,
  mergeRunBtn: document.getElementById("mergeRunBtn") as HTMLButtonElement,

  cropInputBtn: document.getElementById("cropInputBtn") as HTMLButtonElement,
  cropInputManual: document.getElementById("cropInputManual") as HTMLInputElement,
  cropOutputBtn: document.getElementById("cropOutputBtn") as HTMLButtonElement,
  cropOutputManual: document.getElementById("cropOutputManual") as HTMLInputElement,
  cropXInput: document.getElementById("cropXInput") as HTMLInputElement,
  cropYInput: document.getElementById("cropYInput") as HTMLInputElement,
  cropWidthInput: document.getElementById("cropWidthInput") as HTMLInputElement,
  cropHeightInput: document.getElementById("cropHeightInput") as HTMLInputElement,
  cropResetBtn: document.getElementById("cropResetBtn") as HTMLButtonElement,
  cropRunBtn: document.getElementById("cropRunBtn") as HTMLButtonElement,
  cropPreviewVideo: document.getElementById("cropPreviewVideo") as HTMLVideoElement,
  cropOverlayLayer: document.getElementById("cropOverlayLayer") as HTMLDivElement,
  cropSelection: document.getElementById("cropSelection") as HTMLDivElement,
  cropResizeHandle: document.getElementById("cropResizeHandle") as HTMLSpanElement,
  cropInfoText: document.getElementById("cropInfoText") as HTMLParagraphElement,

  volumeInputBtn: document.getElementById("volumeInputBtn") as HTMLButtonElement,
  volumeInputManual: document.getElementById("volumeInputManual") as HTMLInputElement,
  volumeOutputBtn: document.getElementById("volumeOutputBtn") as HTMLButtonElement,
  volumeOutputManual: document.getElementById("volumeOutputManual") as HTMLInputElement,
  volumeDbInput: document.getElementById("volumeDbInput") as HTMLInputElement,
  volumeRunBtn: document.getElementById("volumeRunBtn") as HTMLButtonElement,

  mp3InputBtn: document.getElementById("mp3InputBtn") as HTMLButtonElement,
  mp3InputManual: document.getElementById("mp3InputManual") as HTMLInputElement,
  mp3OutputBtn: document.getElementById("mp3OutputBtn") as HTMLButtonElement,
  mp3OutputManual: document.getElementById("mp3OutputManual") as HTMLInputElement,
  mp3BitrateInput: document.getElementById("mp3BitrateInput") as HTMLSelectElement,
  mp3RunBtn: document.getElementById("mp3RunBtn") as HTMLButtonElement,

  clearLogsBtn: document.getElementById("clearLogsBtn") as HTMLButtonElement,
  logOutput: document.getElementById("logOutput") as HTMLPreElement,
};

const state = {
  previewSourcePath: "",
  previewLoadToken: 0,
  previewMode: "none" as "none" | "generated" | "direct",
  previewFallbackTried: false,
  previewDebounceTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  isBusy: false,
  logLineCount: 0,
  lastProgressOperation: "",
  lastProgressValue: -1,
  cropSourceWidth: 0,
  cropSourceHeight: 0,
  cropRect: { x: 0, y: 0, width: 0, height: 0 },
  cropInteractionMode: "none" as CropInteractionMode,
  cropInteractionStartX: 0,
  cropInteractionStartY: 0,
  cropInteractionStartRect: { x: 0, y: 0, width: 0, height: 0 },
};

function log(message: string) {
  const now = new Date().toLocaleTimeString();
  el.logOutput.textContent += `[${now}] ${message}\n`;
  state.logLineCount += 1;

  if (state.logLineCount > 900 && state.logLineCount % 40 === 0) {
    const lines = el.logOutput.textContent.split("\n");
    const kept = lines.slice(-700);
    el.logOutput.textContent = kept.join("\n");
    state.logLineCount = kept.length;
  }

  el.logOutput.scrollTop = el.logOutput.scrollHeight;
}

function clearLogs() {
  el.logOutput.textContent = "";
  state.logLineCount = 0;
}

function setBusy(isBusy: boolean) {
  state.isBusy = isBusy;
  el.allButtons.forEach((button) => {
    button.disabled = isBusy;
  });

  if (!isBusy) {
    el.taskStatusText.textContent = "Idle";
    el.taskPercentText.textContent = "0%";
    el.taskProgressBar.value = 0;
    updateActionAvailability();
  }
}

function setProgress(operation: string, progress: number) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  if (state.lastProgressOperation === operation && state.lastProgressValue === safeProgress) return;

  state.lastProgressOperation = operation;
  state.lastProgressValue = safeProgress;
  el.taskStatusText.textContent = `Processing: ${operation}`;
  el.taskPercentText.textContent = `${safeProgress}%`;
  el.taskProgressBar.value = safeProgress;
}

function requiredText(input: HTMLInputElement, label: string): string | null {
  const value = input.value.trim();
  if (!value) {
    log(`${label} is required.`);
    return null;
  }
  return value;
}

function toFileUrl(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return `file://${encodeURI(normalized)}`;
  return `file:///${encodeURI(normalized)}`;
}

function formatTime(secondsValue: number): string {
  const safe = Math.max(0, secondsValue);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function resetPreviewElement() {
  el.previewVideo.pause();
  el.previewVideo.removeAttribute("src");
  el.previewVideo.load();
}

function activateTab(tabId: string) {
  el.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });

  el.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function areMergeInputsFilled(): boolean {
  const count = Number(el.mergeCountInput.value);
  const orderedInputs = [
    el.mergeInput1Manual,
    el.mergeInput2Manual,
    el.mergeInput3Manual,
    el.mergeInput4Manual,
    el.mergeInput5Manual,
    el.mergeInput6Manual,
  ];

  for (let i = 0; i < count; i += 1) {
    if (!orderedInputs[i].value.trim()) return false;
  }

  return true;
}

function updateActionAvailability() {
  if (state.isBusy) return;

  const cutReady =
    !!el.cutInputManual.value.trim() &&
    !!el.cutOutputManual.value.trim() &&
    !!el.cutStartInput.value.trim() &&
    !!el.cutEndInput.value.trim();
  el.cutRunBtn.disabled = !cutReady;

  const compressReady =
    !!el.compressInputManual.value.trim() &&
    !!el.compressOutputManual.value.trim() &&
    Number(el.targetSizeInput.value) > 0;
  el.compressRunBtn.disabled = !compressReady;

  const mergeReady = !!el.mergeOutputManual.value.trim() && areMergeInputsFilled();
  el.mergeRunBtn.disabled = !mergeReady;

  const cropReady =
    !!el.cropInputManual.value.trim() &&
    !!el.cropOutputManual.value.trim() &&
    Number(el.cropWidthInput.value) > 1 &&
    Number(el.cropHeightInput.value) > 1;
  el.cropRunBtn.disabled = !cropReady;

  const volumeReady =
    !!el.volumeInputManual.value.trim() &&
    !!el.volumeOutputManual.value.trim() &&
    Number.isFinite(Number(el.volumeDbInput.value));
  el.volumeRunBtn.disabled = !volumeReady;

  const mp3Ready =
    !!el.mp3InputManual.value.trim() &&
    !!el.mp3OutputManual.value.trim() &&
    Number.isFinite(Number(el.mp3BitrateInput.value));
  el.mp3RunBtn.disabled = !mp3Ready;
}

async function pickIntoInput(
  pick: () => Promise<string | null>,
  targetInput: HTMLInputElement,
  actionLabel: string,
) {
  if (!api) {
    log("Electron preload API is unavailable. Restart app from project root using npm run start.");
    return;
  }

  try {
    const value = await pick();
    if (!value) return;
    targetInput.value = value;
    updateActionAvailability();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`${actionLabel} dialog failed: ${msg}. Paste full path manually in the input field.`);
  }
}

function autoFillOutputPath(
  inputPath: string,
  outputInput: HTMLInputElement,
  suffix: string,
  extension: "mp4" | "mp3" = "mp4",
) {
  if (outputInput.value.trim()) return;

  const normalized = inputPath.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const dot = normalized.lastIndexOf(".");
  const folder = slash >= 0 ? normalized.slice(0, slash + 1) : "";
  const fileName = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const baseName = dot > slash ? fileName.slice(0, dot - (slash + 1)) : fileName;
  outputInput.value = `${folder}${baseName}-${suffix}.${extension}`;
}

function openNativeSinglePicker(
  targetInput: HTMLInputElement,
  outputInput: HTMLInputElement,
  suffix: string,
  extension: "mp4" | "mp3" = "mp4",
  onPicked?: (path: string) => void,
) {
  el.nativeSinglePicker.value = "";
  el.nativeSinglePicker.click();

  const currentOutputInput = outputInput;
  const currentSuffix = suffix;
  const currentTargetInput = targetInput;
  const currentOnPicked = onPicked;

  el.nativeSinglePicker.onchange = () => {
    const file = el.nativeSinglePicker.files?.[0] as NativeFile | undefined;
    const filePath = file?.path;
    if (filePath) {
      currentTargetInput.value = filePath;
      autoFillOutputPath(filePath, currentOutputInput, currentSuffix, extension);
      currentOnPicked?.(filePath);
      updateActionAvailability();
      return;
    }

    if (!api) {
      log("Selected file path was unavailable. Paste full path manually.");
      return;
    }

    pickIntoInput(() => api.pickSingleInput(), currentTargetInput, "Dialog fallback pick")
      .then(() => {
        const fallbackPath = currentTargetInput.value.trim();
        if (fallbackPath) {
          autoFillOutputPath(fallbackPath, currentOutputInput, currentSuffix, extension);
          currentOnPicked?.(fallbackPath);
        }
        updateActionAvailability();
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        log(`Dialog fallback failed: ${msg}`);
      });
  };
}

function updateMergeSlotVisibility() {
  const count = Number(el.mergeCountInput.value);
  el.mergeSlots.forEach((slot) => {
    const slotIndex = Number(slot.dataset.slot);
    slot.classList.toggle("hidden", slotIndex > count);
  });
}

function getMergeInputsInOrder(): string[] | null {
  const count = Number(el.mergeCountInput.value);
  const orderedInputs = [
    el.mergeInput1Manual,
    el.mergeInput2Manual,
    el.mergeInput3Manual,
    el.mergeInput4Manual,
    el.mergeInput5Manual,
    el.mergeInput6Manual,
  ];

  const result: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const value = orderedInputs[i].value.trim();
    if (!value) {
      log(`Video ${i + 1} path is required for merge.`);
      return null;
    }
    result.push(value);
  }

  return result;
}

function bindMergePickButton(button: HTMLButtonElement, targetInput: HTMLInputElement, index: number) {
  button.addEventListener("click", () => {
    openNativeSinglePicker(targetInput, el.mergeOutputManual, "merged", "mp4", (pickedPath) => {
      if (index === 0) {
        autoFillOutputPath(pickedPath, el.mergeOutputManual, "merged", "mp4");
      }
      log(`Selected merge input for Video ${index + 1}.`);
    });
  });
}

function schedulePreviewFromInput() {
  if (state.previewDebounceTimer) {
    clearTimeout(state.previewDebounceTimer);
  }
  state.previewDebounceTimer = setTimeout(() => {
    triggerPreviewFromInput();
  }, 170);
}

function loadDirectPreviewSource(inputPath: string) {
  const directVideoUrl = toFileUrl(inputPath);
  log(`Direct preview URL: ${directVideoUrl}`);
  resetPreviewElement();
  el.previewVideo.src = directVideoUrl;
  el.previewVideo.defaultMuted = false;
  el.previewVideo.muted = false;
  el.previewVideo.load();
  void el.previewVideo.play().catch(() => {
    el.previewStatusText.textContent = "Loaded preview (press play for audio)";
  });
  state.previewMode = "direct";
  el.previewStatusText.textContent = "Loaded direct source preview";
}

function loadCutPreview(inputPath: string) {
  const token = ++state.previewLoadToken;
  state.previewSourcePath = inputPath;
  state.previewFallbackTried = false;
  state.previewMode = "none";
  el.previewStatusText.textContent = "Generating compatible preview...";

  if (!api) {
    loadDirectPreviewSource(inputPath);
    return;
  }

  log("Generating compatible preview...");
  void api
    .createPreview({ inputPath })
    .then((previewResult) => {
      if (token !== state.previewLoadToken) return;
      const previewUrl = toFileUrl(previewResult.previewPath);
      log(`Generated preview URL: ${previewUrl}`);
      resetPreviewElement();
      el.previewVideo.src = previewUrl;
      el.previewVideo.defaultMuted = false;
      el.previewVideo.muted = false;
      el.previewVideo.load();
      void el.previewVideo.play().catch(() => {
        el.previewStatusText.textContent = "Compatible preview loaded (press play for audio)";
      });
      state.previewMode = "generated";
      el.previewStatusText.textContent = "Compatible preview loaded";
      log("Loaded generated compatible preview.");
    })
    .catch((error) => {
      if (token !== state.previewLoadToken) return;
      const msg = error instanceof Error ? error.message : String(error);
      log(`Generated preview failed: ${msg}`);
      el.previewStatusText.textContent = "Compatible preview failed, trying direct source...";
      loadDirectPreviewSource(inputPath);
    });
}

function triggerPreviewFromInput() {
  const inputPath = el.cutInputManual.value.trim();
  if (!inputPath) {
    log("Cut input path is required before loading preview.");
    return;
  }
  loadCutPreview(inputPath);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function setCropInfoText(message: string) {
  el.cropInfoText.textContent = message;
}

function syncCropInputsFromRect() {
  el.cropXInput.value = String(state.cropRect.x);
  el.cropYInput.value = String(state.cropRect.y);
  el.cropWidthInput.value = String(state.cropRect.width);
  el.cropHeightInput.value = String(state.cropRect.height);
}

function renderCropSelection() {
  if (state.cropSourceWidth <= 0 || state.cropSourceHeight <= 0) {
    el.cropSelection.style.display = "none";
    return;
  }

  const overlayWidth = el.cropOverlayLayer.clientWidth;
  const overlayHeight = el.cropOverlayLayer.clientHeight;
  if (overlayWidth <= 0 || overlayHeight <= 0) return;

  const left = (state.cropRect.x / state.cropSourceWidth) * overlayWidth;
  const top = (state.cropRect.y / state.cropSourceHeight) * overlayHeight;
  const width = (state.cropRect.width / state.cropSourceWidth) * overlayWidth;
  const height = (state.cropRect.height / state.cropSourceHeight) * overlayHeight;

  el.cropSelection.style.display = "block";
  el.cropSelection.style.left = `${left}px`;
  el.cropSelection.style.top = `${top}px`;
  el.cropSelection.style.width = `${Math.max(8, width)}px`;
  el.cropSelection.style.height = `${Math.max(8, height)}px`;
}

function setCropRect(
  rect: { x: number; y: number; width: number; height: number },
  syncInputs = true,
  updateActions = true,
) {
  if (state.cropSourceWidth <= 0 || state.cropSourceHeight <= 0) return;

  const minSize = 2;
  const width = clamp(Math.round(rect.width), minSize, state.cropSourceWidth);
  const height = clamp(Math.round(rect.height), minSize, state.cropSourceHeight);
  const x = clamp(Math.round(rect.x), 0, state.cropSourceWidth - width);
  const y = clamp(Math.round(rect.y), 0, state.cropSourceHeight - height);

  state.cropRect = { x, y, width, height };

  if (syncInputs) syncCropInputsFromRect();
  renderCropSelection();
  if (updateActions) updateActionAvailability();
}

function initializeDefaultCropRect() {
  if (state.cropSourceWidth <= 0 || state.cropSourceHeight <= 0) return;

  const width = Math.max(2, Math.round(state.cropSourceWidth * 0.8));
  const height = Math.max(2, Math.round(state.cropSourceHeight * 0.8));
  const x = Math.max(0, Math.round((state.cropSourceWidth - width) / 2));
  const y = Math.max(0, Math.round((state.cropSourceHeight - height) / 2));
  setCropRect({ x, y, width, height });
}

function getCropPointFromEvent(event: MouseEvent): { x: number; y: number } | null {
  if (state.cropSourceWidth <= 0 || state.cropSourceHeight <= 0) return null;

  const bounds = el.cropOverlayLayer.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  const offsetX = clamp(event.clientX - bounds.left, 0, bounds.width);
  const offsetY = clamp(event.clientY - bounds.top, 0, bounds.height);

  const x = clamp(Math.round((offsetX / bounds.width) * state.cropSourceWidth), 0, state.cropSourceWidth);
  const y = clamp(Math.round((offsetY / bounds.height) * state.cropSourceHeight), 0, state.cropSourceHeight);
  return { x, y };
}

function applyCropInputsToSelection() {
  if (state.cropSourceWidth <= 0 || state.cropSourceHeight <= 0) return;

  const x = Number(el.cropXInput.value);
  const y = Number(el.cropYInput.value);
  const width = Number(el.cropWidthInput.value);
  const height = Number(el.cropHeightInput.value);

  if (![x, y, width, height].every((value) => Number.isFinite(value))) return;
  setCropRect({ x, y, width, height });
}

function onCropOverlayMouseMove(event: MouseEvent) {
  if (state.cropInteractionMode === "none") return;

  const point = getCropPointFromEvent(event);
  if (!point) return;

  const dx = point.x - state.cropInteractionStartX;
  const dy = point.y - state.cropInteractionStartY;

  if (state.cropInteractionMode === "move") {
    setCropRect({
      x: state.cropInteractionStartRect.x + dx,
      y: state.cropInteractionStartRect.y + dy,
      width: state.cropInteractionStartRect.width,
      height: state.cropInteractionStartRect.height,
    }, false, false);
    return;
  }

  if (state.cropInteractionMode === "resize") {
    setCropRect({
      x: state.cropInteractionStartRect.x,
      y: state.cropInteractionStartRect.y,
      width: state.cropInteractionStartRect.width + dx,
      height: state.cropInteractionStartRect.height + dy,
    }, false, false);
    return;
  }

  if (state.cropInteractionMode === "create") {
    const x = Math.min(state.cropInteractionStartX, point.x);
    const y = Math.min(state.cropInteractionStartY, point.y);
    const width = Math.max(2, Math.abs(point.x - state.cropInteractionStartX));
    const height = Math.max(2, Math.abs(point.y - state.cropInteractionStartY));
    setCropRect({ x, y, width, height }, false, false);
  }
}

function onCropOverlayMouseUp() {
  state.cropInteractionMode = "none";
  window.removeEventListener("mousemove", onCropOverlayMouseMove);

  syncCropInputsFromRect();
  updateActionAvailability();

  if (state.cropRect.width > 0 && state.cropRect.height > 0) {
    setCropInfoText(
      `Crop ${state.cropRect.width}x${state.cropRect.height} at (${state.cropRect.x}, ${state.cropRect.y})`,
    );
  }
}

function onCropOverlayMouseDown(event: MouseEvent) {
  if (state.cropSourceWidth <= 0 || state.cropSourceHeight <= 0) return;

  const point = getCropPointFromEvent(event);
  if (!point) return;

  const target = event.target as Node;
  const isResize = target === el.cropResizeHandle || el.cropResizeHandle.contains(target);
  const isSelection = target === el.cropSelection || el.cropSelection.contains(target);

  state.cropInteractionStartX = point.x;
  state.cropInteractionStartY = point.y;
  state.cropInteractionStartRect = { ...state.cropRect };

  if (isResize) {
    state.cropInteractionMode = "resize";
  } else if (isSelection) {
    state.cropInteractionMode = "move";
  } else {
    state.cropInteractionMode = "create";
    setCropRect({ x: point.x, y: point.y, width: 2, height: 2 });
  }

  window.addEventListener("mousemove", onCropOverlayMouseMove);
  window.addEventListener("mouseup", onCropOverlayMouseUp, { once: true });
  event.preventDefault();
}

function loadCropPreview(inputPath: string) {
  if (!inputPath) {
    setCropInfoText("Load a video to start cropping.");
    return;
  }

  const cropVideoUrl = toFileUrl(inputPath);
  el.cropPreviewVideo.pause();
  el.cropPreviewVideo.removeAttribute("src");
  el.cropPreviewVideo.load();

  state.cropSourceWidth = 0;
  state.cropSourceHeight = 0;
  state.cropRect = { x: 0, y: 0, width: 0, height: 0 };
  renderCropSelection();

  el.cropPreviewVideo.src = cropVideoUrl;
  el.cropPreviewVideo.load();
  setCropInfoText("Loading crop preview...");
}

function triggerCropPreviewFromInput() {
  const inputPath = el.cropInputManual.value.trim();
  if (!inputPath) {
    setCropInfoText("Load a video to start cropping.");
    return;
  }

  loadCropPreview(inputPath);
}

if (!api) {
  log("Preload bridge missing. File dialogs and actions will not work until app is restarted correctly.");
} else {
  api.onLog((line) => {
    log(line.trim());
  });

  api.onProgress((payload) => {
    setProgress(payload.operation, payload.progress);
  });
}

el.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tabId = button.dataset.tab;
    if (!tabId) return;
    activateTab(tabId);
  });
});

el.clearLogsBtn.addEventListener("click", () => {
  clearLogs();
});

el.previewVideo.addEventListener("timeupdate", () => {
  el.currentTimeText.textContent = `Current: ${formatTime(el.previewVideo.currentTime)}`;
});

el.previewVideo.addEventListener("loadedmetadata", () => {
  el.previewStatusText.textContent = "Metadata loaded";
  log(`Preview metadata loaded. Duration: ${formatTime(el.previewVideo.duration || 0)}`);
});

el.previewVideo.addEventListener("canplay", () => {
  el.previewStatusText.textContent = "Preview ready";
  log("Preview is ready to play.");
});

el.previewVideo.addEventListener("loadeddata", () => {
  el.previewStatusText.textContent = "Preview data loaded";
});

el.previewVideo.addEventListener("error", () => {
  const mediaErrorCode = el.previewVideo.error?.code;
  el.previewStatusText.textContent = `Preview error${mediaErrorCode ? ` (${mediaErrorCode})` : ""}`;
  log(`Preview media error${mediaErrorCode ? ` (code ${mediaErrorCode})` : ""}.`);

  if (state.previewMode === "generated" && !state.previewFallbackTried && state.previewSourcePath) {
    state.previewFallbackTried = true;
    log("Generated preview errored. Trying direct source fallback...");
    loadDirectPreviewSource(state.previewSourcePath);
  }
});

el.cropPreviewVideo.addEventListener("loadedmetadata", () => {
  state.cropSourceWidth = el.cropPreviewVideo.videoWidth;
  state.cropSourceHeight = el.cropPreviewVideo.videoHeight;
  initializeDefaultCropRect();
  setCropInfoText(
    `Source ${state.cropSourceWidth}x${state.cropSourceHeight}. Drag to create, move, or resize the crop box.`,
  );
});

el.cropPreviewVideo.addEventListener("loadeddata", () => {
  renderCropSelection();
});

el.cropPreviewVideo.addEventListener("error", () => {
  setCropInfoText("Could not load crop preview. Try another format or path.");
  log("Crop preview failed to load.");
});

el.cropOverlayLayer.addEventListener("mousedown", onCropOverlayMouseDown);
window.addEventListener("resize", renderCropSelection);

el.setStartFromCurrentBtn.addEventListener("click", () => {
  el.cutStartInput.value = formatTime(el.previewVideo.currentTime);
  updateActionAvailability();
});

el.setEndFromCurrentBtn.addEventListener("click", () => {
  el.cutEndInput.value = formatTime(el.previewVideo.currentTime);
  updateActionAvailability();
});

el.cutInputManual.addEventListener("change", () => {
  schedulePreviewFromInput();
  updateActionAvailability();
});

el.cutInputManual.addEventListener("blur", () => {
  if (!el.cutInputManual.value.trim()) return;
  schedulePreviewFromInput();
  updateActionAvailability();
});

el.cutInputManual.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  triggerPreviewFromInput();
  updateActionAvailability();
});

el.cutInputBtn.addEventListener("click", () => {
  openNativeSinglePicker(el.cutInputManual, el.cutOutputManual, "cut", "mp4", (path) => {
    loadCutPreview(path);
  });
});

el.cutOutputBtn.addEventListener("click", async () => {
  await pickIntoInput(() => api!.pickOutput("cut.mp4"), el.cutOutputManual, "Output pick");
});

el.cutRunBtn.addEventListener("click", async () => {
  if (!api) return;

  const inputPath = requiredText(el.cutInputManual, "Cut input path");
  const outputPath = requiredText(el.cutOutputManual, "Cut output path");
  const startTime = el.cutStartInput.value.trim();
  const endTime = el.cutEndInput.value.trim();
  const mode = el.cutModeInput.value as "lossless" | "reencode";

  if (!inputPath || !outputPath || !startTime || !endTime) {
    log("Cut requires input, output, start, and end values.");
    return;
  }

  try {
    setBusy(true);
    log(`Starting cut (${mode})...`);
    await api.cut({ inputPath, outputPath, startTime, endTime, mode });
    log("Cut completed.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Cut failed: ${msg}`);
  } finally {
    setBusy(false);
  }
});

el.compressInputBtn.addEventListener("click", () => {
  openNativeSinglePicker(el.compressInputManual, el.compressOutputManual, "compressed", "mp4");
});

el.compressOutputBtn.addEventListener("click", async () => {
  await pickIntoInput(() => api!.pickOutput("compressed.mp4"), el.compressOutputManual, "Output pick");
});

el.compressRunBtn.addEventListener("click", async () => {
  if (!api) return;

  const inputPath = requiredText(el.compressInputManual, "Compression input path");
  const outputPath = requiredText(el.compressOutputManual, "Compression output path");
  if (!inputPath || !outputPath) return;

  const targetSizeMB = Number(el.targetSizeInput.value);
  const preset = el.presetInput.value as "ultrafast" | "fast" | "medium" | "slow";

  try {
    setBusy(true);
    log(`Starting compression toward ~${targetSizeMB.toFixed(1)}MB...`);
    await api.compress({ inputPath, outputPath, targetSizeMB, preset });
    log("Compression completed.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Compression failed: ${msg}`);
  } finally {
    setBusy(false);
  }
});

el.mergeCountInput.addEventListener("change", () => {
  updateMergeSlotVisibility();
  updateActionAvailability();
});

bindMergePickButton(el.mergeInput1Btn, el.mergeInput1Manual, 0);
bindMergePickButton(el.mergeInput2Btn, el.mergeInput2Manual, 1);
bindMergePickButton(el.mergeInput3Btn, el.mergeInput3Manual, 2);
bindMergePickButton(el.mergeInput4Btn, el.mergeInput4Manual, 3);
bindMergePickButton(el.mergeInput5Btn, el.mergeInput5Manual, 4);
bindMergePickButton(el.mergeInput6Btn, el.mergeInput6Manual, 5);

[
  el.mergeInput1Manual,
  el.mergeInput2Manual,
  el.mergeInput3Manual,
  el.mergeInput4Manual,
  el.mergeInput5Manual,
  el.mergeInput6Manual,
  el.mergeOutputManual,
].forEach((input) => {
  input.addEventListener("input", updateActionAvailability);
});

el.mergeOutputBtn.addEventListener("click", async () => {
  await pickIntoInput(() => api!.pickOutput("merged.mp4"), el.mergeOutputManual, "Output pick");
});

el.mergeRunBtn.addEventListener("click", async () => {
  if (!api) return;

  const outputPath = requiredText(el.mergeOutputManual, "Merge output path");
  if (!outputPath) return;

  const orderedInputs = getMergeInputsInOrder();
  if (!orderedInputs) return;

  const mode = el.mergeModeInput.value as "stream-copy" | "universal";

  try {
    setBusy(true);
    log(`Starting ordered merge (${mode}) with ${orderedInputs.length} videos...`);
    await api.merge({ inputPaths: orderedInputs, outputPath, mode });
    log("Merge completed.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Merge failed: ${msg}`);
  } finally {
    setBusy(false);
  }
});

el.cropInputManual.addEventListener("change", () => {
  triggerCropPreviewFromInput();
  updateActionAvailability();
});

el.cropInputManual.addEventListener("blur", () => {
  if (!el.cropInputManual.value.trim()) return;
  triggerCropPreviewFromInput();
  updateActionAvailability();
});

el.cropInputManual.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  triggerCropPreviewFromInput();
  updateActionAvailability();
});

el.cropInputBtn.addEventListener("click", () => {
  openNativeSinglePicker(el.cropInputManual, el.cropOutputManual, "cropped", "mp4", (path) => {
    loadCropPreview(path);
  });
});

el.cropOutputBtn.addEventListener("click", async () => {
  await pickIntoInput(() => api!.pickOutput("cropped.mp4"), el.cropOutputManual, "Output pick");
});

el.cropResetBtn.addEventListener("click", () => {
  if (state.cropSourceWidth <= 0 || state.cropSourceHeight <= 0) return;
  initializeDefaultCropRect();
  setCropInfoText("Crop selection reset.");
});

[el.cropXInput, el.cropYInput, el.cropWidthInput, el.cropHeightInput].forEach((input) => {
  input.addEventListener("input", () => {
    applyCropInputsToSelection();
  });
});

el.cropRunBtn.addEventListener("click", async () => {
  if (!api) return;

  const inputPath = requiredText(el.cropInputManual, "Crop input path");
  const outputPath = requiredText(el.cropOutputManual, "Crop output path");
  if (!inputPath || !outputPath) return;

  const x = Number(el.cropXInput.value);
  const y = Number(el.cropYInput.value);
  const width = Number(el.cropWidthInput.value);
  const height = Number(el.cropHeightInput.value);

  if (![x, y, width, height].every((value) => Number.isFinite(value)) || width <= 1 || height <= 1) {
    log("Crop values must be valid numbers and width/height must be greater than 1.");
    return;
  }

  try {
    setBusy(true);
    log(`Starting crop (${width}x${height} at ${x},${y})...`);
    await api.crop({ inputPath, outputPath, x, y, width, height });
    log("Crop completed.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Crop failed: ${msg}`);
  } finally {
    setBusy(false);
  }
});

el.volumeInputBtn.addEventListener("click", () => {
  openNativeSinglePicker(el.volumeInputManual, el.volumeOutputManual, "volume-adjusted", "mp4");
});

el.volumeOutputBtn.addEventListener("click", async () => {
  await pickIntoInput(() => api!.pickOutput("volume-adjusted.mp4"), el.volumeOutputManual, "Output pick");
});

el.volumeRunBtn.addEventListener("click", async () => {
  if (!api) return;

  const inputPath = requiredText(el.volumeInputManual, "Volume input path");
  const outputPath = requiredText(el.volumeOutputManual, "Volume output path");
  if (!inputPath || !outputPath) return;

  const volumeDb = Number(el.volumeDbInput.value);

  try {
    setBusy(true);
    log(`Starting audio gain adjustment (${volumeDb} dB)...`);
    await api.adjustVolume({ inputPath, outputPath, volumeDb });
    log("Volume adjust completed.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Volume adjust failed: ${msg}`);
  } finally {
    setBusy(false);
  }
});

el.mp3InputBtn.addEventListener("click", () => {
  openNativeSinglePicker(el.mp3InputManual, el.mp3OutputManual, "audio", "mp3");
});

el.mp3OutputBtn.addEventListener("click", async () => {
  await pickIntoInput(() => api!.pickOutput("audio.mp3"), el.mp3OutputManual, "Output pick");
});

el.mp3RunBtn.addEventListener("click", async () => {
  if (!api) return;

  const inputPath = requiredText(el.mp3InputManual, "MP4 input path");
  const outputPath = requiredText(el.mp3OutputManual, "MP3 output path");
  if (!inputPath || !outputPath) return;

  const bitrateKbps = Number(el.mp3BitrateInput.value);

  try {
    setBusy(true);
    log(`Starting MP4 to MP3 conversion (${bitrateKbps} kbps)...`);
    await api.toMp3({ inputPath, outputPath, bitrateKbps });
    log("MP4 to MP3 conversion completed.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`MP4 to MP3 conversion failed: ${msg}`);
  } finally {
    setBusy(false);
  }
});

[
  el.cutInputManual,
  el.cutOutputManual,
  el.cutStartInput,
  el.cutEndInput,
  el.compressInputManual,
  el.compressOutputManual,
  el.targetSizeInput,
  el.cropInputManual,
  el.cropOutputManual,
  el.cropXInput,
  el.cropYInput,
  el.cropWidthInput,
  el.cropHeightInput,
  el.volumeInputManual,
  el.volumeOutputManual,
  el.volumeDbInput,
  el.mp3InputManual,
  el.mp3OutputManual,
  el.mp3BitrateInput,
].forEach((input) => {
  input.addEventListener("input", updateActionAvailability);
});

updateMergeSlotVisibility();
updateActionAvailability();
