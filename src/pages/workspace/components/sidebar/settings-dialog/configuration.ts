import * as LucideIcons from "lucide-react";
import type { SettingsTabConfig } from "../settings/types";

export const SETTINGS_TABS: SettingsTabConfig[] = [
  { id: "general", label: "通用设置", icon: LucideIcons.Settings },
  { id: "shortcuts", label: "快捷键", icon: LucideIcons.Keyboard },
  { id: "local-folder", label: "本地文件夹", icon: LucideIcons.FolderOpen },
  { id: "appearance", label: "外观主题", icon: LucideIcons.Laptop },
  { id: "ai", label: "AI 助手", icon: LucideIcons.Sparkles },
  { id: "data", label: "数据管理", icon: LucideIcons.Database },
];

export const BLOCK_APP = {
  name: "Block",
  icon: "./apps/block.png",
  url: "https://block.cooool.top",
};

export const FEEDBACK_URL = "https://wj.qq.com/s2/25958121/2d2e/";

export const SETTINGS_APPS_BANNER_ID = "settings:recommended-apps-banner";

export const isElectronHost = __HOST_TARGET__ === "electron";
