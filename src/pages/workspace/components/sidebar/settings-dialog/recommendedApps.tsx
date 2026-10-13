import * as LucideIcons from "lucide-react";
import { ExternalLink } from "lucide-react";
import { HostAdapter } from "@/lib/host/adapter";
import { GOOSE_APPS, isElectronHost } from "./configuration";

const handleOpenApp = (app: (typeof GOOSE_APPS)[number]) => {
  HostAdapter.openUrl(app.url, false);
};

export function renderRecommendedAppsBanner({
  appsBannerVisible,
  handleCloseAppsBanner,
}: {
  appsBannerVisible: boolean;
  handleCloseAppsBanner: () => void;
}) {
  return appsBannerVisible && !isElectronHost ? (
    <div className="relative rounded-[10px] bg-[hsl(var(--goose-selected-bg)/0.62)] p-3">
      <button
        type="button"
        onClick={handleCloseAppsBanner}
        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)]"
        aria-label="关闭鹅的全家桶"
      >
        <LucideIcons.X className="h-3 w-3" />
      </button>
      <p className="mb-2 pr-4 text-xs font-medium text-muted-foreground">
        鹅的全家桶
      </p>
      <div className="space-y-1">
        {GOOSE_APPS.map((app) => (
          <Button
            key={app.id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleOpenApp(app)}
            className="h-auto w-full justify-start gap-2 rounded-[10px] px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]"
          >
            <img
              src={app.icon}
              alt=""
              className="h-4 w-4 shrink-0 rounded-[4px] object-cover"
            />
            <span className="flex-1 truncate">{app.name}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        ))}
      </div>
    </div>
  ) : null;
}
