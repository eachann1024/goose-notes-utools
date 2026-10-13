import type { RefObject } from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AIModelOption } from "@/lib/ai-provider";
import { cn } from "@/lib/utils";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import { SETTINGS_OPTION_ROW_CLASS } from "./styles";

interface SettingsAIModelsSectionProps {
  modelSectionRef: RefObject<HTMLDivElement | null>;
  savingCustomConfig: boolean;
  customSaveError: string | null;
  customModels: AIModelOption[];
  currentModel: AIModelOption | null;
  saveButtonReason: string | null;
  onRefreshModels: () => void;
  modelButtonDisabled: boolean;
  modelButtonReason: string | null;
  selectedModelId: string | null;
  handleModelChange: (modelId: string) => void;
}

export function SettingsAIModelsSection({
  modelSectionRef,
  savingCustomConfig,
  customSaveError,
  customModels,
  currentModel,
  saveButtonReason,
  onRefreshModels,
  modelButtonDisabled,
  modelButtonReason,
  selectedModelId,
  handleModelChange,
}: SettingsAIModelsSectionProps) {
  return (
    <div
      ref={modelSectionRef}
      id="ai-model-settings"
      tabIndex={-1}
      className="scroll-mt-6 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <SettingsSectionCard
        title={
          <span className="flex items-center gap-2">
            <LucideIcons.Brain
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            AI 模型
          </span>
        }
        description={
          <span className="block">
            选择全局默认模型
            <span
              className="mt-1 block font-medium text-foreground/75"
              role="status"
              aria-live="polite"
            >
              {savingCustomConfig
                ? "正在获取模型列表…"
                : customSaveError
                  ? `获取失败：${customSaveError}`
                  : customModels.length > 0
                    ? `已获取 ${customModels.length} 个${currentModel ? ` · ${currentModel.label}` : ""}`
                    : "尚未获取到模型"}
            </span>
          </span>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(saveButtonReason)}
            onClick={onRefreshModels}
          >
            {savingCustomConfig ? (
              <LucideIcons.LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LucideIcons.RefreshCw className="h-4 w-4" />
            )}
            {savingCustomConfig ? "获取中…" : "重新获取模型"}
          </Button>
        }
      >
        <div className="space-y-3">
          <div
            className={cn(
              "flex items-center justify-between gap-4 p-4",
              SETTINGS_OPTION_ROW_CLASS,
            )}
          >
            <div className="flex items-center gap-3">
              <LucideIcons.Cpu
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  默认模型
                </Label>
              </div>
            </div>
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={modelButtonDisabled}
                          className={cn(
                            "min-w-[220px] justify-between rounded-[10px]",
                            modelButtonDisabled && "cursor-not-allowed",
                          )}
                        >
                          <span className="truncate">
                            {currentModel?.label ??
                              modelButtonReason ??
                              "请选择模型"}
                          </span>
                          <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[280px]"
                        style={{
                          maxHeight: "min(360px, var(--available-height))",
                        }}
                      >
                        <DropdownMenuRadioGroup
                          value={selectedModelId ?? ""}
                          onValueChange={handleModelChange}
                        >
                          {customModels.map((model) => (
                            <DropdownMenuRadioItem
                              key={model.id}
                              value={model.id}
                              className="items-start gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-foreground">
                                  {model.label}
                                </div>
                                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {model.description || model.id}
                                </div>
                              </div>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TooltipTrigger>
                {modelButtonReason ? (
                  <TooltipContent side="left">
                    {modelButtonReason}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
