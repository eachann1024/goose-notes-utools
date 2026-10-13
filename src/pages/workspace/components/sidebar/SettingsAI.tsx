import { useEffect, useMemo, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_CLAUDE_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  fetchCustomAIModels,
  getAIProviderPreset,
  getProviderFixedBaseURL,
  getStoredAIModelOptions,
  isAIProviderId,
  resolveProtocolForProvider,
  type AIModelOption,
  type AIProviderId,
  type CustomAIProtocol,
} from "@/lib/ai-provider";
import type { AISettings } from "@/stores/useSettings";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { cn } from "@/lib/utils";
import { SettingsAIModelsSection } from "./settings-ai/SettingsAIModelsSection";
import { SettingsAIProviderSection } from "./settings-ai/SettingsAIProviderSection";
import { SETTINGS_OPTION_ROW_CLASS } from "./settings-ai/styles";

interface SettingsAIProps {
  ai: AISettings;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  setReadGlobalPrompt: (enabled: boolean) => void;
  setReadLocalSkills: (enabled: boolean) => void;
  selectedModelId: string | null;
  setSelectedModelId: (modelId: string | null) => void;
  saveCustomConfig: (config: {
    providerId: AIProviderId;
    protocol?: CustomAIProtocol;
    baseURL: string;
    apiKey: string;
    modelOptions: AIModelOption[];
  }) => void;
}

const CUSTOM_AI_KEY_HINT = "请前往“设置 -> AI 助手 -> AI 服务”补充 API Key";

interface ProviderConnection {
  providerId: AIProviderId;
  protocol: CustomAIProtocol;
  baseURL: string;
  apiKey: string;
}

function readStoredApiKey(
  ai: AISettings,
  providerId: AIProviderId,
  protocol: CustomAIProtocol,
): string {
  if (providerId === "deepseek") {
    return (
      ai.customOpenAIResponsesApiKey?.trim() ||
      ai.customOpenAIApiKey?.trim() ||
      ""
    );
  }
  if (protocol === "openai-responses")
    return ai.customOpenAIResponsesApiKey || "";
  if (protocol === "openai") return ai.customOpenAIApiKey || "";
  return ai.customClaudeApiKey || "";
}

function readStoredBaseURL(
  ai: AISettings,
  providerId: AIProviderId,
  protocol: CustomAIProtocol,
): string {
  const fixed = getProviderFixedBaseURL(providerId);
  if (fixed) return fixed;
  if (protocol === "openai-responses") {
    return ai.customOpenAIResponsesBaseURL || DEFAULT_OPENAI_BASE_URL;
  }
  if (protocol === "openai") {
    return ai.customOpenAIBaseURL || DEFAULT_OPENAI_BASE_URL;
  }
  return ai.customClaudeBaseURL || DEFAULT_CLAUDE_BASE_URL;
}

export function SettingsAI({
  ai,
  enabled,
  setEnabled,
  setReadGlobalPrompt,
  setReadLocalSkills,
  selectedModelId,
  setSelectedModelId,
  saveCustomConfig,
}: SettingsAIProps) {
  const initialProviderId: AIProviderId = isAIProviderId(ai.customProviderId)
    ? ai.customProviderId
    : "deepseek";
  const [providerId, setProviderId] = useState<AIProviderId>(initialProviderId);
  const [customBaseURL, setCustomBaseURL] = useState(() =>
    readStoredBaseURL(ai, initialProviderId, ai.customProtocol),
  );
  const [apiKeyDraft, setApiKeyDraft] = useState(() =>
    readStoredApiKey(ai, initialProviderId, ai.customProtocol),
  );
  const [savingCustomConfig, setSavingCustomConfig] = useState(false);
  const [customSaveError, setCustomSaveError] = useState<string | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const modelSectionRef = useRef<HTMLDivElement | null>(null);
  const modelRequestIdRef = useRef(0);

  const storedCustomModels = getStoredAIModelOptions(ai);
  const customModels =
    providerId === ai.customProviderId ? storedCustomModels : [];

  const selectedProvider = useMemo(
    () => getAIProviderPreset(providerId),
    [providerId],
  );
  const allowCustomBaseURL = selectedProvider.allowCustomBaseURL;
  const activeProtocol = resolveProtocolForProvider(
    providerId,
    selectedModelId,
    selectedProvider.protocol,
  );

  useEffect(() => {
    const nextProvider = isAIProviderId(ai.customProviderId)
      ? ai.customProviderId
      : "deepseek";
    setProviderId(nextProvider);
    setCustomBaseURL(readStoredBaseURL(ai, nextProvider, ai.customProtocol));
    setApiKeyDraft(readStoredApiKey(ai, nextProvider, ai.customProtocol));
  }, [
    ai.customProviderId,
    ai.customProtocol,
    ai.customOpenAIResponsesBaseURL,
    ai.customOpenAIBaseURL,
    ai.customClaudeBaseURL,
    ai.customOpenAIResponsesApiKey,
    ai.customOpenAIApiKey,
    ai.customClaudeApiKey,
  ]);

  useEffect(() => {
    if (customModels.length === 0) {
      return;
    }

    if (
      !selectedModelId ||
      !customModels.some((item) => item.id === selectedModelId)
    ) {
      setSelectedModelId(customModels[0].id);
    }
  }, [customModels, selectedModelId, setSelectedModelId]);

  const currentModel =
    customModels.find((item) => item.id === selectedModelId) ?? null;

  const getConnectionForProvider = (
    nextProviderId: AIProviderId,
    nextApiKey = apiKeyDraft,
    nextBaseURL = customBaseURL,
  ): ProviderConnection => {
    const preset = getAIProviderPreset(nextProviderId);
    const protocol = resolveProtocolForProvider(
      nextProviderId,
      selectedModelId,
      preset.protocol,
    );
    const fixed = getProviderFixedBaseURL(nextProviderId);
    const fallback =
      protocol === "claude" ? DEFAULT_CLAUDE_BASE_URL : DEFAULT_OPENAI_BASE_URL;
    const baseURL = ((fixed ?? nextBaseURL.trim()) || fallback).replace(
      /\/+$/,
      "",
    );
    return {
      providerId: nextProviderId,
      protocol,
      baseURL: baseURL || fallback,
      apiKey: nextApiKey,
    };
  };

  const scrollToModelSection = () => {
    requestAnimationFrame(() => {
      const target = modelSectionRef.current;
      if (!target) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    });
  };

  const saveButtonReason = savingCustomConfig
    ? "正在保存并读取模型列表"
    : !apiKeyDraft.trim()
      ? CUSTOM_AI_KEY_HINT
      : allowCustomBaseURL && !customBaseURL.trim()
        ? "请填写 Base URL"
        : null;

  const modelButtonDisabled =
    !enabled || savingCustomConfig || customModels.length === 0;

  const modelButtonReason = !enabled
    ? "先打开 AI 助手开关后才能选择模型"
    : savingCustomConfig
      ? "模型列表读取中，请稍候"
      : customSaveError
        ? customSaveError
        : customModels.length === 0
          ? "请先填写 API Key 并保存配置"
          : null;

  const refreshCustomModels = async (
    connection: ProviderConnection,
    action: "save" | "switch" | "refresh",
  ) => {
    const apiKey = connection.apiKey.trim();
    if (!apiKey) {
      toast.error(CUSTOM_AI_KEY_HINT);
      return;
    }

    const provider = getAIProviderPreset(connection.providerId);
    const requestId = modelRequestIdRef.current + 1;
    modelRequestIdRef.current = requestId;
    setSavingCustomConfig(true);
    setCustomSaveError(null);

    // 先持久化供应商 / Key / Base URL，避免拉模型失败时配置丢失。
    const previousModelOptions =
      connection.providerId === ai.customProviderId ? storedCustomModels : [];
    saveCustomConfig({
      providerId: connection.providerId,
      protocol: connection.protocol,
      baseURL: connection.baseURL,
      apiKey,
      modelOptions: previousModelOptions,
    });

    try {
      // DeepSeek 模型列表走兼容 /models；协议按模型在请求时分支。
      const listProtocol: CustomAIProtocol =
        connection.providerId === "deepseek" ? "openai" : connection.protocol;
      const modelOptions = await fetchCustomAIModels({
        protocol: listProtocol,
        baseURL: connection.baseURL,
        apiKey,
        providerId: connection.providerId,
      });
      if (requestId !== modelRequestIdRef.current) return;

      const nextModel =
        modelOptions.find((model) => model.id === selectedModelId) ??
        modelOptions[0] ??
        null;
      const nextProtocol = resolveProtocolForProvider(
        connection.providerId,
        nextModel?.id ?? null,
        connection.protocol,
      );

      saveCustomConfig({
        providerId: connection.providerId,
        protocol: nextProtocol,
        baseURL: connection.baseURL,
        apiKey,
        modelOptions,
      });

      setSelectedModelId(nextModel?.id ?? null);
      scrollToModelSection();

      if (modelOptions.length === 0) {
        toast.warning(`${provider.label} 配置已保存`, {
          description: "已获取 0 个模型，请确认该服务是否提供模型列表接口。",
        });
      } else {
        const actionLabel =
          action === "switch"
            ? `已切换到 ${provider.label}`
            : action === "refresh"
              ? `${provider.label} 模型列表已更新`
              : `${provider.label} 配置已保存`;
        toast.success(actionLabel, {
          description: `已获取 ${modelOptions.length} 个模型，默认选择 ${nextModel?.label ?? nextModel?.id}。`,
        });
      }
    } catch (error) {
      if (requestId !== modelRequestIdRef.current) return;
      const message =
        error instanceof Error ? error.message : "保存 AI 配置失败";
      setCustomSaveError(message);
      toast.error(message, {
        description:
          action === "refresh"
            ? "模型列表未更新，已保留当前配置。"
            : "API Key 已保存，模型列表未能更新。",
      });
    } finally {
      if (requestId === modelRequestIdRef.current) {
        setSavingCustomConfig(false);
      }
    }
  };

  const handleSaveCustomConfig = async () => {
    if (saveButtonReason) {
      toast.error(saveButtonReason);
      return;
    }
    await refreshCustomModels(getConnectionForProvider(providerId), "save");
  };

  const handleProviderChange = (value: string) => {
    if (!isAIProviderId(value) || value === providerId) return;
    setCustomSaveError(null);
    setProviderId(value);

    const nextPreset = getAIProviderPreset(value);
    const nextBaseURL =
      getProviderFixedBaseURL(value) ??
      (nextPreset.protocol === "claude"
        ? DEFAULT_CLAUDE_BASE_URL
        : DEFAULT_OPENAI_BASE_URL);
    setCustomBaseURL(nextBaseURL);

    // 仅当切回当前已保存供应商时复用草稿 Key；否则只读该供应商在 store 中的 Key，避免串用。
    const finalKey =
      value === ai.customProviderId
        ? apiKeyDraft
        : readStoredApiKey(ai, value, nextPreset.protocol);
    setApiKeyDraft(finalKey);

    if (!finalKey.trim()) {
      toast.info(`已切换到 ${nextPreset.label}`, {
        description: "填写 API Key 并保存后，将自动获取模型列表。",
      });
      return;
    }

    void refreshCustomModels(
      getConnectionForProvider(value, finalKey, nextBaseURL),
      "switch",
    );
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    // DeepSeek 选 Pro/Flash 时协议会变；若已有 Key，同步持久化协议槽位。
    if (providerId !== "deepseek" || !apiKeyDraft.trim()) return;
    const connection = getConnectionForProvider(providerId);
    const protocol = resolveProtocolForProvider(
      providerId,
      modelId,
      connection.protocol,
    );
    saveCustomConfig({
      providerId,
      protocol,
      baseURL: connection.baseURL,
      apiKey: connection.apiKey.trim(),
      modelOptions: customModels,
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        AI 助手
      </h3>

      <SettingsSectionCard>
        <div
          className={cn(
            "flex items-center justify-between gap-4 p-4",
            SETTINGS_OPTION_ROW_CLASS,
          )}
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <AiGradientIcon className="h-4 w-4 text-foreground" />
              <Label
                htmlFor="ai-enabled"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                启用 AI 写作助手
              </Label>
            </div>
            <div className="text-xs leading-5 text-muted-foreground">
              关闭后隐藏所有 AI 入口，并停止当前生成。
            </div>
          </div>
          <Switch
            id="ai-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </SettingsSectionCard>

      <SettingsAIModelsSection
        modelSectionRef={modelSectionRef}
        savingCustomConfig={savingCustomConfig}
        customSaveError={customSaveError}
        customModels={customModels}
        currentModel={currentModel}
        saveButtonReason={saveButtonReason}
        modelButtonDisabled={modelButtonDisabled}
        modelButtonReason={modelButtonReason}
        selectedModelId={selectedModelId}
        handleModelChange={handleModelChange}
        onRefreshModels={() => {
          void refreshCustomModels(
            getConnectionForProvider(providerId),
            "refresh",
          );
        }}
      />

      <SettingsAIProviderSection
        providerId={providerId}
        selectedProvider={selectedProvider}
        savingCustomConfig={savingCustomConfig}
        allowCustomBaseURL={allowCustomBaseURL}
        customBaseURL={customBaseURL}
        setCustomBaseURL={setCustomBaseURL}
        apiKeyDraft={apiKeyDraft}
        setApiKeyDraft={setApiKeyDraft}
        setCustomSaveError={setCustomSaveError}
        apiKeyVisible={apiKeyVisible}
        setApiKeyVisible={setApiKeyVisible}
        activeProtocol={activeProtocol}
        saveButtonReason={saveButtonReason}
        handleProviderChange={handleProviderChange}
        handleSaveCustomConfig={handleSaveCustomConfig}
      />

      <SettingsSectionCard
        title={
          <span className="flex items-center gap-2">
            <LucideIcons.FolderCog
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            本地 AI 上下文
          </span>
        }
        description="开启后，全局提示词与本地 Skill 会参与 AI 对话。"
      >
        <div className="space-y-2">
          <div
            className={cn(
              "flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="space-y-1">
              <Label
                htmlFor="ai-read-global-prompt"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                读取全局提示词
              </Label>
              <div className="text-xs leading-5 text-muted-foreground">
                并入 AI 系统提示词
              </div>
            </div>
            <Switch
              id="ai-read-global-prompt"
              checked={ai.readGlobalPrompt}
              onCheckedChange={setReadGlobalPrompt}
            />
          </div>
          <div
            className={cn(
              "flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="space-y-1">
              <Label
                htmlFor="ai-read-local-skills"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                读取本地 Skill
              </Label>
              <div className="text-xs leading-5 text-muted-foreground">
                输入 / 调用
              </div>
            </div>
            <Switch
              id="ai-read-local-skills"
              checked={ai.readLocalSkills}
              onCheckedChange={setReadLocalSkills}
            />
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
