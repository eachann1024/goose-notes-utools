import * as LucideIcons from "lucide-react";

export function renderResetConfirmation({
  resetDialogOpen,
  setResetDialogOpen,
  resetPhrase,
  resetInput,
  setResetInput,
  canReset,
  resetting,
  handleManualReset,
}: {
  resetDialogOpen: boolean;
  setResetDialogOpen: (open: boolean) => void;
  resetPhrase: string;
  resetInput: string;
  setResetInput: (value: string) => void;
  canReset: boolean;
  resetting: boolean;
  handleManualReset: () => Promise<void>;
}) {
  return (
    <DialogShell
      open={resetDialogOpen}
      onOpenChange={setResetDialogOpen}
      layout="fullscreen"
      contentClassName="bg-[hsl(var(--goose-shell-bg))]"
      bodyClassName="relative h-full overflow-y-auto p-6 animate-in fade-in duration-200"
    >
      <div className="relative mx-auto w-full max-w-md py-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[14px] mb-4 bg-[var(--goose-color-danger-subtle-bg)]">
            <LucideIcons.AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            确认重置所有数据？
          </h1>
          <p className="text-muted-foreground">
            这将永久删除内部记事本、页面、历史、AI
            会话、标签和应用设置；不会删除本地文件夹中的磁盘文件
          </p>
        </div>

        <div className="bg-[var(--goose-color-danger-subtle-bg)] backdrop-blur-[1px] rounded-[14px] p-6 shadow-[0_12px_26px_rgba(15,23,42,0.1)] space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-medium text-destructive select-none">
              请输入以下短语以确认重置：
              <span className="ml-1 select-text font-bold text-foreground">
                {resetPhrase}
              </span>
            </div>
            <Input
              id="reset-all"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder={resetPhrase}
              className="h-12 text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && canReset && !resetting) {
                  void handleManualReset();
                }
              }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setResetDialogOpen(false)}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={() => void handleManualReset()}
              disabled={!canReset || resetting}
              className="flex-1"
            >
              {resetting ? "正在重置…" : "确认重置"}
            </Button>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
