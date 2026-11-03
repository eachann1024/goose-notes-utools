import { getUToolsApi } from "./env";

/**
 * 速记小窗（独立 browser 窗口）自身的窗口控制封装。
 *
 * 关键约束（见项目 memory utools-createbrowserwindow-api）：
 * createBrowserWindow 返回的 win 只在「创建者侧」（主窗 preload）可用，且不含实例事件。
 * 因此子窗口不能直接调 win.setAlwaysOnTop / win.close，必须通过 utools.sendToParent
 * 把请求发回主窗 preload，由持有 win 的一方执行。失焦隐藏则由子窗内 web 原生 blur 触发。
 */
const send = (channel: string, ...args: unknown[]) => {
  const utools = getUToolsApi();
  if (utools && typeof utools.sendToParent === "function") {
    utools.sendToParent(channel, ...args);
    return true;
  }
  return false;
};

// Electron 桌面端：小窗是静态第二窗（label=quicknote，visible:false），
// 收起=隐藏 BrowserWindow（常驻后台、草稿随窗口存活），不依赖 sendToParent。
// 动态 import + 构建期常量守卫：uTools 构建里该分支被整体摇掉。
const isElectronHost = __HOST_TARGET__ === "electron";

const hideElectronQuicknoteWindow = (): void => {
  const api = window.gooseDesktop;
  if (!api) return;
  void api.hideQuicknote().catch((error) => {
    console.warn("[quicknote] Electron 小窗隐藏失败", error);
  });
};

export const quickNoteWindow = {
  /**
   * 收起小窗。请求主窗把窗口「隐藏」（常驻后台，下次唤起秒显，不销毁），
   * 兜底 window.close()。主窗侧 quicknote:close → hideQuickNoteWindow。
   */
  close(): void {
    if (isElectronHost) {
      hideElectronQuicknoteWindow();
      return;
    }
    if (!send("quicknote:close")) {
      try {
        window.close();
      } catch {
        /* noop */
      }
    }
  },

  /** 通知主窗某条笔记已被小窗改动，主窗据此从 db 重读该页（防跨窗脏写）。 */
  notifyNoteUpdated(pageId: string): void {
    send("quicknote:note-updated", pageId);
  },

  /** 请求父窗把小窗高度设为 height（自动调整高度模式用；宽度不变）。 */
  setHeight(height: number): void {
    send("quicknote:set-height", Math.round(height));
  },

  /**
   * 用户拖动边框停下后调用：请求主窗用 win.getSize() 读取真实窗口尺寸并写回
   * dbStorage（持久化），下次开窗沿用。子窗渲染进程的 window.outerWidth 在 uTools
   * frameless 窗口里 resize 后并不可靠，故由持有 win 的主窗权威读取，不传具体数值。
   */
  persistSize(): void {
    send("quicknote:persist-size");
  },

  /**
   * 用户拖动窗口移动停下后调用：把子窗当前屏幕坐标（screenX/screenY）上报父窗，
   * 由父窗直接写回 dbStorage。移动不触发 resize，且关窗时父窗 getBounds() 在窗口
   * 销毁瞬间可能取到旧值，故移动停下就主动上报，确保最后位置可靠落库。
   */
  persistPosition(x: number, y: number): void {
    send("quicknote:persist-position", { x: Math.round(x), y: Math.round(y) });
  },

  /**
   * B 插件子窗保存：preload 把 blocks JSON 写成临时 .goosequicknote，
   * 再 redirect 到主插件的文件匹配指令「速记入库」。
   * 开发模式只按指令名跳转。按插件名会命中已安装的正式版「鹅的笔记」，
   * 正式版没有这条指令时 uTools 报未找到功能；开发版 A 才能接住。
   * 正式环境仍用 [插件名, 指令名]，避免同名指令串到别的插件。
   * 子窗里的 utools.redirect 已经能唤起主插件（旧的功能指令只是丢掉了 payload），
   * 所以写文件和 redirect 都留在子窗。父窗开窗后已 outPlugin，不经手这次保存。
   * blocks 直接传 PartialBlock[] 原值，A 侧落库时自行 normalize。
   * 返回临时文件路径。redirect 的返回值不能当成功：开发版未接住时 uTools 只弹错，调用仍可能不抛。
   * 调用方轮询该文件是否被主插件删除。写文件失败返回 null。
   */
  redirectSaveToMainApp(blocks: unknown): string | null {
    const ut = getUToolsApi();
    const writeFile = window.__gooseQuickNoteWriteSaveFile;
    if (
      !ut ||
      typeof ut.redirect !== "function" ||
      typeof writeFile !== "function"
    ) {
      return null;
    }
    let filePath: string | null = null;
    try {
      filePath = writeFile(JSON.stringify(blocks));
    } catch {
      return null;
    }
    if (!filePath) return null;
    try {
      // isDev() 为 true 时只按指令名查找，命中带「速记入库」的开发版。
      const target = ut.isDev?.()
        ? "速记入库"
        : ["鹅的笔记", "速记入库"];
      ut.redirect(target, {
        type: "files",
        data: filePath,
      });
    } catch {
      // 跳转抛错也不在这里判失败：文件还在，调用方轮询后超时再删。
    }
    return filePath;
  },

  /**
   * 请求隐藏（与 close 同走 quicknote:close → 主窗 hideQuickNoteWindow）：
   * 窗口常驻后台、下次秒显。保留此导出名以维持外部调用兼容性。
   */
  hide(): void {
    if (isElectronHost) {
      hideElectronQuicknoteWindow();
      return;
    }
    if (!send("quicknote:close")) {
      try {
        window.close();
      } catch {
        /* noop */
      }
    }
  },
};
