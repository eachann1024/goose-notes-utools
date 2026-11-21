import {
  bucket,
  durationBucket,
  flush,
  initTelemetry,
  isTelemetryEnabled,
  setTelemetryEnabled,
  subscribeTelemetry,
  telemetryPreview,
  track,
  trackError,
  type TelemetryProps,
} from "@/lib/telemetry";
import { uToolsStorage } from "@/lib/storage";

export type TelemetrySurface = "workspace" | "quicknote";

const TOKEN_RE = /^[A-Za-z0-9_.:+-]{1,40}$/;

let currentSurface: TelemetrySurface = "workspace";
let currentModule = "workspace";
let initialized = false;
let sessionActive = false;
let sessionStartedAt = Date.now();
let justColdStarted = false;
let coldStartTimer: ReturnType<typeof setTimeout> | null = null;

function syncEnabledFromSharedStorage(): void {
  try {
    const raw = uToolsStorage.getItem("goose:telemetry:v1");
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object" && "enabled" in parsed) {
      const enabled = (parsed as { enabled?: unknown }).enabled !== false;
      if (enabled !== isTelemetryEnabled()) {
        setTelemetryEnabled(enabled);
      }
    }
  } catch {
    /* ignore */
  }
}

function clearColdStartGuard(): void {
  justColdStarted = false;
  if (coldStartTimer !== null) {
    clearTimeout(coldStartTimer);
    coldStartTimer = null;
  }
}

const normalizeToken = (value: unknown, fallback: string): string => {
  const s = typeof value === "string" ? value.trim() : "";
  return TOKEN_RE.test(s) ? s : fallback;
};

export function setAnalyticsSurface(surface: TelemetrySurface): void {
  currentSurface = surface;
  currentModule = surface;
}

export function setAnalyticsModule(module: string): void {
  currentModule = normalizeToken(module, currentSurface);
}

export function trackEvent(name: string, props?: TelemetryProps): void {
  track(name, {
    surface: currentSurface,
    ...props,
  });
}

export function trackAppError(error: unknown, module?: string): void {
  trackError(error, module ?? currentModule);
}

export function trackNotebookCount(count: number): void {
  trackEvent("notebook.count", { range: bucket(count) });
}

function startSession(): void {
  if (!sessionActive) {
    sessionActive = true;
    sessionStartedAt = Date.now();
  }
}

function endSession(): void {
  clearColdStartGuard();
  if (!sessionActive) return;
  sessionActive = false;
  const elapsed = Math.max(0, Date.now() - sessionStartedAt);
  trackEvent("app.session", { dur: durationBucket(elapsed) });
  void flush(true);
}

export function initAppTelemetry(options: {
  surface: TelemetrySurface;
  entry?: string;
  coldMs?: number;
  theme?: () => string;
  onWarmEnter?: () => void;
}): void {
  setAnalyticsSurface(options.surface);

  if (initialized) return;
  initialized = true;
  justColdStarted = true;
  coldStartTimer = setTimeout(() => {
    clearColdStartGuard();
  }, 1500);

  if (typeof window !== "undefined") {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        endSession();
      } else {
        startSession();
      }
    };

    const handlePageHide = () => {
      endSession();
    };

    const handlePluginOut = () => {
      endSession();
    };

    const handlePluginEnter = (event: Event) => {
      startSession();
      if (currentSurface !== "workspace") return;
      if (justColdStarted) {
        clearColdStartGuard();
        return;
      }
      const code = (event as CustomEvent<{ code?: string }>).detail?.code;
      trackEvent("app.open", { entry: normalizeToken(code, "gn") });
      options.onWarmEnter?.();
    };

    const handleQuicknoteEnter = (event: Event) => {
      syncEnabledFromSharedStorage();
      startSession();
      if (currentSurface !== "quicknote") return;
      if (justColdStarted) {
        clearColdStartGuard();
        return;
      }
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
      const entry = mode === "last" ? "quicknote_last" : "quicknote_new";
      trackEvent("app.open", { entry });
    };

    // Register before initTelemetry so app.session is queued before SDK beacon flush.
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("goose-note:plugin-out", handlePluginOut);
    window.addEventListener("goose-note:plugin-enter", handlePluginEnter);
    window.addEventListener("goose-note:quicknote-enter", handleQuicknoteEnter);
  }

  initTelemetry({
    project: "notes",
    version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0",
    storage: uToolsStorage,
    theme: options.theme,
    osVersion: () =>
      typeof window !== "undefined"
        ? window.__gooseSystemInfo?.osVersion || ""
        : "",
    arch: () =>
      typeof window !== "undefined"
        ? window.__gooseSystemInfo?.arch || ""
        : "",
    module: () => currentModule,
  });

  startSession();

  const fallbackEntry = options.surface === "quicknote" ? "quicknote" : "gn";
  const entry = normalizeToken(options.entry, fallbackEntry);
  const openProps: TelemetryProps = { entry };
  if (typeof options.coldMs === "number" && Number.isFinite(options.coldMs)) {
    openProps.cold_ms = Math.round(Math.max(0, options.coldMs));
  }
  trackEvent("app.open", openProps);
}

