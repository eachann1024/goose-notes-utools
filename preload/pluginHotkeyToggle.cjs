"use strict";

/** 主插件「打开鹅的笔记」的入口。gn_notes 只是多一组搜索词，行为与 gn 相同。 */
const MAIN_FEATURE_CODE = "gn";
const MAIN_FEATURE_CODES = new Set(["gn", "gn_notes"]);

/**
 * 对齐小窗：同一条启动指令在窗口已显示时再触发 = 收起，而不是再进一次。
 *
 * - 只处理打开笔记本的入口（gn、gn_notes）。新建笔记 / 打开文件夹 / 速记入库仍走各自逻辑。
 * - from === "hotkey"：用户绑定的全局快捷键，这是要修复的路径。
 * - from 缺失：旧 uTools 可能不传 from，仍按「再按一次关闭」处理。
 * - from 为 main / panel / redirect：搜索框或跳转进入，只聚焦，不关窗。
 */
function shouldHideOnHotkeyRetrigger({ code, from, pluginVisible }) {
  if (!pluginVisible) return false;
  if (!MAIN_FEATURE_CODES.has(code)) return false;
  if (from !== undefined && from !== null && from !== "hotkey") return false;
  return true;
}

/**
 * 收起到后台，不杀进程。分离窗口 hideMainWindow 无效，必须 outPlugin(false)。
 * 顺序对齐小窗 releaseHostToUToolsMain：清 subInput → hide → out。
 */
function hidePluginToBackground(utoolsApi) {
  if (!utoolsApi) return;
  try {
    utoolsApi.removeSubInput?.();
  } catch {
    /* noop */
  }
  try {
    utoolsApi.hideMainWindow?.();
  } catch {
    /* noop */
  }
  try {
    utoolsApi.outPlugin?.(false);
  } catch {
    /* noop */
  }
}

module.exports = {
  MAIN_FEATURE_CODE,
  shouldHideOnHotkeyRetrigger,
  hidePluginToBackground,
};
