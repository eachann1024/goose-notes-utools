import { useMemo, type ComponentType } from "react";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type LocalFolderOpenAppCandidate } from "@/lib/local-folder-open-apps";
import * as LucideIcons from "lucide-react";
import { SETTINGS_OPTION_ROW_CLASS } from "./definitions";

export interface OpenAppFieldProps {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  onChange: (value: string) => void;
  defaultLabel: string;
  options: LocalFolderOpenAppCandidate[];
}

export const SYSTEM_VALUE = "__system__";

export function OpenAppField({
  id,
  title,
  description,
  icon: Icon,
  value,
  onChange,
  defaultLabel,
  options,
}: OpenAppFieldProps) {
  const trimmedValue = value.trim();
  const matchedOption = useMemo(
    () =>
      options.find(
        (option) =>
          option.id === trimmedValue || option.appName === trimmedValue,
      ),
    [options, trimmedValue],
  );

  const selectedValue = matchedOption ? matchedOption.id : SYSTEM_VALUE;
  const selectedLabel = matchedOption ? matchedOption.label : defaultLabel;

  const handleSelect = (nextValue: string) => {
    if (nextValue === SYSTEM_VALUE) {
      onChange("");
      return;
    }
    onChange(nextValue);
  };

  return (
    <div className={`space-y-3 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Icon
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Label htmlFor={id} className="cursor-pointer">
              {title}
            </Label>
          </div>
          <p className="mt-1 pl-7 text-xs text-muted-foreground">
            {description}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              id={id}
              type="button"
              className="flex h-9 min-w-36 max-w-56 shrink-0 items-center justify-between gap-2 rounded-[10px] bg-[hsl(var(--background))] px-3 text-left text-sm text-foreground shadow-[inset_0_0_0_1px_hsl(var(--input))] transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)] focus:bg-[var(--goose-interactive-selected)] data-[state=open]:bg-[var(--goose-interactive-hover)]"
            >
              <span className="truncate">{selectedLabel}</span>
              <LucideIcons.ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuRadioGroup
              value={selectedValue}
              onValueChange={handleSelect}
            >
              <DropdownMenuRadioItem value={SYSTEM_VALUE}>
                <span className="truncate">{defaultLabel}</span>
              </DropdownMenuRadioItem>
              {options.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  <span className="truncate">{option.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
