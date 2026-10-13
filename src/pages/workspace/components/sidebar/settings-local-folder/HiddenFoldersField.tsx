import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as LucideIcons from "lucide-react";
import {
  DEFAULT_HIDDEN_FOLDERS,
  SETTINGS_OPTION_ROW_CLASS,
} from "./definitions";

export interface HiddenFoldersFieldProps {
  folders: string[];
  onChange: (folders: string[]) => void;
}

export function HiddenFoldersField({
  folders,
  onChange,
}: HiddenFoldersFieldProps) {
  const [inputValue, setInputValue] = useState("");

  const addFolder = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    if (folders.includes(name)) return;
    onChange([...folders, name]);
    setInputValue("");
  };

  const removeFolder = (name: string) => {
    onChange(folders.filter((f) => f !== name));
  };

  const resetToDefault = () => {
    onChange([...DEFAULT_HIDDEN_FOLDERS]);
  };

  const isDefault =
    JSON.stringify(folders) === JSON.stringify(DEFAULT_HIDDEN_FOLDERS);

  return (
    <div className={`space-y-3 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
      <div>
        <div className="flex items-center gap-3">
          <LucideIcons.EyeOff
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Label
            htmlFor="local-folder-hidden-folder-input"
            className="cursor-pointer"
          >
            隐藏文件夹
          </Label>
        </div>
        <p className="mt-1 pl-7 text-xs text-muted-foreground">
          这些文件夹不会显示在本地文件夹笔记本的侧边栏中。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pl-7">
        {folders.length === 0 && (
          <span className="text-xs text-muted-foreground">
            未隐藏任何文件夹
          </span>
        )}
        {folders.map((folder) => {
          const isDefaultFolder = DEFAULT_HIDDEN_FOLDERS.includes(folder);
          return (
            <Badge
              key={folder}
              variant={isDefaultFolder ? "default" : "secondary"}
              className="gap-1 pr-1.5"
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

      <div className="flex items-center gap-2 pl-7">
        <Input
          id="local-folder-hidden-folder-input"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFolder(inputValue);
            }
          }}
          placeholder="如：obsidian"
          className="h-9 text-sm"
        />
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0"
          onClick={() => addFolder(inputValue)}
        >
          添加
        </Button>
      </div>

      {!isDefault && (
        <div className="pl-7">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]"
            onClick={resetToDefault}
          >
            恢复默认
          </Button>
        </div>
      )}
    </div>
  );
}
