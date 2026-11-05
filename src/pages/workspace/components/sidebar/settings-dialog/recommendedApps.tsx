import * as LucideIcons from "lucide-react";
import { HostAdapter } from "@/lib/host/adapter";
import { BLOCK_APP, isElectronHost } from "./configuration";

const handleOpenBlock = () => {
  HostAdapter.openUrl(BLOCK_APP.url, false);
};

export function renderRecommendedAppsBanner({
  appsBannerVisible,
  handleCloseAppsBanner,
}: {
  appsBannerVisible: boolean;
  handleCloseAppsBanner: () => void;
}) {
  return appsBannerVisible && !isElectronHost ? (
    <section
      aria-label="Block 推荐"
      className="relative flex flex-col gap-3 rounded-[14px] border border-[#e6e6e6] dark:border-border bg-white dark:bg-card p-3 text-card-foreground shadow-none"
    >
      <button
        type="button"
        onClick={handleCloseAppsBanner}
        className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)]"
        aria-label="关闭推荐"
      >
        <LucideIcons.X className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={handleOpenBlock}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-transparent p-0 text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={BLOCK_APP.icon}
          alt=""
          className="h-10 w-10 shrink-0 rounded-[10px] object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="whitespace-nowrap pr-5 text-[16px] font-bold leading-[21px] text-foreground">
            鹅的笔记 完全体
          </span>
          <span className="whitespace-nowrap text-[15px] font-normal leading-[20px] text-foreground">
            小鹅也梳上背头啦
          </span>
        </div>
      </button>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-[10px] bg-[#f4f6fa] dark:bg-[hsl(var(--goose-selected-bg))] px-1 py-2 text-center">
          <span className="whitespace-nowrap text-[15px] font-semibold leading-[20px] tabular-nums text-[#4a7be6] dark:text-[#6b9dff]">
            24.5 ms
          </span>
          <span className="whitespace-nowrap text-[14px] leading-[18px] text-muted-foreground">
            瞬间打开
          </span>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-[10px] bg-[#f4f6fa] dark:bg-[hsl(var(--goose-selected-bg))] px-1 py-2 text-center">
          <span className="whitespace-nowrap text-[15px] font-semibold leading-[20px] tabular-nums text-[#4a7be6] dark:text-[#6b9dff]">
            117 MB
          </span>
          <span className="whitespace-nowrap text-[14px] leading-[18px] text-muted-foreground">
            内存
          </span>
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-[10px] bg-[#f4f6fa] dark:bg-[hsl(var(--goose-selected-bg))] px-1 py-2 text-center">
          <span className="whitespace-nowrap text-[15px] font-semibold leading-[20px] tabular-nums text-[#4a7be6] dark:text-[#6b9dff]">
            27 MB
          </span>
          <span className="whitespace-nowrap text-[14px] leading-[18px] text-muted-foreground">
            体积
          </span>
        </div>
      </div>

      <p className="m-0 whitespace-nowrap text-[14px] leading-[20px] text-muted-foreground">
        10 万块文档即开即写，依然免费
        <br />
        我奶的电脑都能秒开!
      </p>

      <button
        type="button"
        onClick={handleOpenBlock}
        className="flex h-10 w-full cursor-pointer items-center justify-center rounded-[10px] bg-[#4a7be6] text-[14px] font-medium text-white transition-colors hover:bg-[#3563c9] active:bg-[#2c53a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        去看看
      </button>
    </section>
  ) : null;
}
