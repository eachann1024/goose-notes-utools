import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseHiddenFolderRule } from "@/lib/local-folder-hidden-rules";
import * as LucideIcons from "lucide-react";
import {
  DEFAULT_HIDDEN_FOLDERS,
  SETTINGS_OPTION_ROW_CLASS,
} from "./definitions";

export interface HiddenFoldersFieldProps {
  folders: string[];
  onChange: (folders: string[]) => void;
}

const INPUT_ID = "local-folder-hidden-folder-input";
const DESCRIPTION_ID = "local-folder-hidden-folder-description";
const ERROR_ID = "local-folder-hidden-folder-error";

export function HiddenFoldersField({
  folders,
  onChange,
}: HiddenFoldersFieldProps) {
  const [inputValue, setInputValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addFolder = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const parsed = parseHiddenFolderRule(trimmed);
    if (parsed.error) {
      setErrorMessage(parsed.error);
      return;
    }

    if (folders.includes(parsed.raw)) {
      setErrorMessage("该隐藏规则已存在");
      return;
    }

    setErrorMessage(null);
    onChange([...folders, parsed.raw]);
    setInputValue("");
  };

  const removeFolder = (name: string) => {
    setErrorMessage(null);
    onChange(folders.filter((f) => f !== name));
  };

  const resetToDefault = () => {
    setErrorMessage(null);
    onChange([...DEFAULT_HIDDEN_FOLDERS]);
  };

  const isDefault =
    JSON.stringify(folders) === JSON.stringify(DEFAULT_HIDDEN_FOLDERS);

  const describedBy = errorMessage
    ? `${DESCRIPTION_ID} ${ERROR_ID}`
    : DESCRIPTION_ID;

  return (
    <div className={`space-y-3 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
      <div>
        <div className="flex items-center gap-3">
          <LucideIcons.EyeOff
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Label htmlFor={INPUT_ID} className="cursor-pointer text-sm">
            隐藏文件夹
          </Label>
        </div>
        <p
          id={DESCRIPTION_ID}
          className="mt-1 pl-7 text-sm text-muted-foreground"
        >
          不显示在本地文件夹侧边栏中。支持文件夹名或正则（如{" "}
          <code className="rounded bg-[hsl(var(--foreground)/0.08)] px-1 py-0.5 font-mono text-sm text-foreground">
            /^\./
          </code>
          、
          <code className="rounded bg-[hsl(var(--foreground)/0.08)] px-1 py-0.5 font-mono text-sm text-foreground">
            /^temp/i
          </code>
          ）；以{" "}
          <code className="rounded bg-[hsl(var(--foreground)/0.08)] px-1 py-0.5 font-mono text-sm text-foreground">
            .
          </code>{" "}
          开头的目录默认已隐藏。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pl-7">
        {folders.length === 0 && (
          <span className="text-sm text-muted-foreground">
            未隐藏任何文件夹
          </span>
        )}
        {folders.map((folder) => {
          const isDefaultFolder = DEFAULT_HIDDEN_FOLDERS.includes(folder);
          const parsed = parseHiddenFolderRule(folder);
          const isRegexRule = parsed.kind === "regex" && !parsed.error;
          return (
            <Badge
              key={folder}
              variant={isDefaultFolder ? "default" : "secondary"}
              className={`gap-1 pr-1.5 text-sm ${isRegexRule ? "font-mono" : ""}`}
            >
              {folder}
              <button
                type="button"
                disabled={isDefaultFolder}
                onClick={() => removeFolder(folder)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-50 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]"
                aria-label={`移除 ${folder}`}
              >
                <LucideIcons.X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>

      <div className="space-y-1.5 pl-7">
        <div className="flex items-center gap-2">
          <Input
            id={INPUT_ID}
            value={inputValue}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={describedBy}
            onChange={(event) => {
              setInputValue(event.target.value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                addFolder(inputValue);
              }
            }}
            placeholder="如：obsidian 或 /^\./"
            className="h-9 text-sm"
          />
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 text-sm"
            onClick={() => addFolder(inputValue)}
          >
            添加
          </Button>
        </div>

        {errorMessage && (
          <p
            id={ERROR_ID}
            role="alert"
            className="text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}
      </div>

      {!isDefault && (
        <div className="pl-7">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-sm text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]"
            onClick={resetToDefault}
          >
            恢复默认
          </Button>
        </div>
      )}
    </div>
  );
}
