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

export const GOOSE_APPS = [
  {
    id: "goose-quicknote",
    name: "鹅的小窗",
    icon: "./apps/goose-quicknote.png",
    storeQuery: "鹅的小窗",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E5%B0%8F%E7%AA%97/",
  },
  {
    id: "goose-marks",
    name: "鹅的书签",
    icon: "./apps/goose-marks.png",
    storeQuery: "鹅的书签",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E4%B9%A6%E7%AD%BE/",
  },
  {
    id: "goose-monitor",
    name: "鹅的监控",
    icon: "./apps/goose-monitor.png",
    storeQuery: "鹅的监控",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E7%9B%91%E6%8E%A7/",
  },
  {
    id: "goose-2fa",
    name: "鹅的二次验证",
    icon: "./apps/goose-2fa.png",
    storeQuery: "鹅的二次验证（2FA）",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E4%BA%8C%E6%AC%A1%E9%AA%8C%E8%AF%81%EF%BC%882FA%EF%BC%89/",
  },
];

export const FEEDBACK_URL = "https://wj.qq.com/s2/25958121/2d2e/";

export const SETTINGS_APPS_BANNER_ID = "settings:recommended-apps-banner";

export const isElectronHost = __HOST_TARGET__ === "electron";
