import type { ComponentType, Dispatch, SetStateAction } from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AI_PROVIDER_PRESETS,
  DEFAULT_CLAUDE_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  type AIProviderId,
  type AIProviderPreset,
  type CustomAIProtocol,
} from "@/lib/ai-provider";
import { cn } from "@/lib/utils";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import { SETTINGS_OPTION_ROW_CLASS } from "./styles";

interface SettingsAIProviderSectionProps {
  providerId: AIProviderId;
  selectedProvider: AIProviderPreset;
  savingCustomConfig: boolean;
  allowCustomBaseURL: boolean;
  customBaseURL: string;
  setCustomBaseURL: (value: string) => void;
  apiKeyDraft: string;
  setApiKeyDraft: (value: string) => void;
  setCustomSaveError: (error: string | null) => void;
  apiKeyVisible: boolean;
  setApiKeyVisible: Dispatch<SetStateAction<boolean>>;
  activeProtocol: CustomAIProtocol;
  saveButtonReason: string | null;
  handleProviderChange: (value: string) => void;
  handleSaveCustomConfig: () => Promise<void>;
}

/** 供应商菜单图标：与预设文案解耦，避免 presets 依赖 React */
const PROVIDER_ICONS: Record<
  AIProviderId,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  deepseek: LucideIcons.Sparkles,
  glm: LucideIcons.Brain,
  minimax: LucideIcons.AudioLines,
  "custom-openai-responses": LucideIcons.Zap,
  "custom-openai": LucideIcons.Boxes,
  "custom-claude": LucideIcons.MessageSquare,
};

function ProviderIconTile({
  providerId,
  size = "md",
}: {
  providerId: AIProviderId;
  size?: "sm" | "md";
}) {
  const Icon = PROVIDER_ICONS[providerId] ?? LucideIcons.Server;
  const isSm = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[8px] bg-[var(--goose-block-subtle-bg)] text-muted-foreground",
        isSm ? "h-6 w-6 rounded-[7px]" : "h-8 w-8",
      )}
      aria-hidden
    >
      <Icon className={isSm ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.75} />
    </span>
  );
}

export function SettingsAIProviderSection({
  providerId,
  selectedProvider,
  savingCustomConfig,
  allowCustomBaseURL,
  customBaseURL,
  setCustomBaseURL,
  apiKeyDraft,
  setApiKeyDraft,
  setCustomSaveError,
  apiKeyVisible,
  setApiKeyVisible,
  activeProtocol,
  saveButtonReason,
  handleProviderChange,
  handleSaveCustomConfig,
}: SettingsAIProviderSectionProps) {
  return (
    <SettingsSectionCard
      title={
        <span className="flex items-center gap-2">
          <LucideIcons.Bot
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          AI 服务
        </span>
      }
      description="选择供应商，只需填写 API Key。"
    >
      <div className="space-y-3">
        <div className="space-y-3">
          <div
            className={cn(
              "flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="flex items-center gap-3">
              <ProviderIconTile providerId={providerId} />
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  供应商
                </Label>
                <p className="text-xs text-muted-foreground">
                  {selectedProvider.description}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingCustomConfig}
                  className="min-w-[200px] justify-between rounded-[10px] px-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ProviderIconTile providerId={providerId} size="sm" />
                    <span className="truncate">{selectedProvider.label}</span>
                  </span>
                  <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[288px] p-1.5">
                {AI_PROVIDER_PRESETS.map((option) => {
                  const selected = option.id === providerId;
                  return (
                    <DropdownMenuItem
                      key={option.id}
                      onSelect={() => handleProviderChange(option.id)}
                      className={cn(
                        "cursor-pointer gap-2.5 rounded-[10px] px-2 py-2",
                        selected &&
                          "bg-[var(--goose-interactive-selected)] text-foreground",
                      )}
                    >
                      <ProviderIconTile providerId={option.id} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium leading-5 text-foreground">
                          {option.label}
                        </div>
                        <div className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                      <LucideIcons.Check
                        className={cn(
                          "h-4 w-4 shrink-0 text-foreground",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                        strokeWidth={2}
                        aria-hidden={!selected}
                      />
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {allowCustomBaseURL ? (
            <div className={cn("space-y-3 p-4", SETTINGS_OPTION_ROW_CLASS)}>
              <div className="flex items-center gap-3">
                <LucideIcons.Globe
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <Label
                  htmlFor="custom-ai-base-url"
                  className="text-sm font-medium text-foreground"
                >
                  Base URL
                </Label>
              </div>
              <Input
                id="custom-ai-base-url"
                value={customBaseURL}
                onChange={(event) => {
                  setCustomSaveError(null);
                  setCustomBaseURL(event.target.value);
                }}
                placeholder={
                  activeProtocol === "claude"
                    ? DEFAULT_CLAUDE_BASE_URL
                    : DEFAULT_OPENAI_BASE_URL
                }
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ) : null}

          <div className={cn("space-y-3 p-4", SETTINGS_OPTION_ROW_CLASS)}>
            <div className="flex items-center gap-3">
              <LucideIcons.KeyRound
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label
                htmlFor="custom-ai-api-key"
                className="text-sm font-medium text-foreground"
              >
                API Key
              </Label>
            </div>
            <div className="relative">
              <Input
                id="custom-ai-api-key"
                type={apiKeyVisible ? "text" : "password"}
                value={apiKeyDraft}
                onChange={(event) => {
                  setCustomSaveError(null);
                  setApiKeyDraft(event.target.value);
                }}
                placeholder="输入后点保存自动拉取模型"
                autoComplete="off"
                spellCheck={false}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)]"
                onClick={() => setApiKeyVisible((visible) => !visible)}
                aria-label={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                aria-pressed={apiKeyVisible}
              >
                {apiKeyVisible ? (
                  <LucideIcons.EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <LucideIcons.Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="flex items-center gap-3">
              <LucideIcons.Download
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  保存配置
                </Label>
                <p className="text-xs text-muted-foreground">
                  {allowCustomBaseURL
                    ? "保存 Base URL 与 API Key，并自动拉取可用模型列表。"
                    : "保存 API Key，并自动拉取可用模型列表。"}
                </p>
              </div>
            </div>
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      size="sm"
                      disabled={Boolean(saveButtonReason)}
                      onClick={() => {
                        void handleSaveCustomConfig();
                      }}
                      className={cn(
                        Boolean(saveButtonReason) && "cursor-not-allowed",
                      )}
                    >
                      {!savingCustomConfig && (
                        <LucideIcons.Save className="h-4 w-4" />
                      )}
                      {savingCustomConfig ? "保存中..." : "保存"}
                    </Button>
                  </div>
                </TooltipTrigger>
                {saveButtonReason ? (
                  <TooltipContent side="left">
                    {saveButtonReason}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );
}
