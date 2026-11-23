export interface LocalSecretsPayload {
  customOpenAIResponsesApiKey?: string;
  customOpenAIApiKey?: string;
  customClaudeApiKey?: string;
  tinyfishApiKey?: string;
  webdavPassword?: string;
}

const LOCAL_SECRETS_STORAGE_KEY = "goose-note-local-secrets";

function getBridge() {
  if (typeof window === "undefined") return null;
  return (
    (
      window as Window & {
        gooseLocalSecrets?: {
          read?: () => LocalSecretsPayload | null;
          write?: (secrets: LocalSecretsPayload) => boolean;
        };
      }
    ).gooseLocalSecrets ?? null
  );
}

function normalizeSecrets(raw: unknown): LocalSecretsPayload {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const pick = (key: keyof LocalSecretsPayload): string | undefined => {
    const val = obj[key];
    return typeof val === "string" && val.length > 0 ? val : undefined;
  };
  return {
    customOpenAIResponsesApiKey: pick("customOpenAIResponsesApiKey"),
    customOpenAIApiKey: pick("customOpenAIApiKey"),
    customClaudeApiKey: pick("customClaudeApiKey"),
    tinyfishApiKey: pick("tinyfishApiKey"),
    webdavPassword: pick("webdavPassword"),
  };
}

export function readLocalSecrets(): LocalSecretsPayload {
  try {
    const bridge = getBridge();
    if (bridge?.read) {
      return normalizeSecrets(bridge.read());
    }
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_SECRETS_STORAGE_KEY);
      if (raw) {
        return normalizeSecrets(JSON.parse(raw));
      }
    }
  } catch {
    // ignore
  }
  return {};
}

export function writeLocalSecrets(next: LocalSecretsPayload): void {
  try {
    const sanitized: LocalSecretsPayload = {
      customOpenAIResponsesApiKey: next.customOpenAIResponsesApiKey || "",
      customOpenAIApiKey: next.customOpenAIApiKey || "",
      customClaudeApiKey: next.customClaudeApiKey || "",
      tinyfishApiKey: next.tinyfishApiKey || "",
      webdavPassword: next.webdavPassword || "",
    };
    const bridge = getBridge();
    if (bridge?.write) {
      bridge.write(sanitized);
      return;
    }
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        LOCAL_SECRETS_STORAGE_KEY,
        JSON.stringify(sanitized),
      );
    }
  } catch {
    // ignore
  }
}

export function hasAnySecret(secrets: LocalSecretsPayload): boolean {
  return Boolean(
    secrets.customOpenAIResponsesApiKey ||
      secrets.customOpenAIApiKey ||
      secrets.customClaudeApiKey ||
      secrets.tinyfishApiKey ||
      secrets.webdavPassword,
  );
}
