import { useEffect, useMemo, useState } from "react";
import {
  LOCAL_FOLDER_EDITOR_CANDIDATES,
  LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
  LOCAL_FOLDER_TERMINAL_CANDIDATES,
  type LocalFolderOpenAppCandidate,
} from "@/lib/local-folder-open-apps";
import { getCachedAvailableOpenApps, shell } from "@/lib/utools/shell";
import {
  SYSTEM_FILE_MANAGER_IDS,
  SYSTEM_TERMINAL_IDS,
  getSystemDefaultLabels,
} from "./definitions";
import { type SettingsLocalFolderBindings } from "./bindings";

export function useLocalFolderOpenAppOptions() {
  const [fileManagerOptions, setFileManagerOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(() => {
    const cached = getCachedAvailableOpenApps(
      LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
    );
    return cached
      ? cached.filter((item) => !SYSTEM_FILE_MANAGER_IDS.has(item.id))
      : [];
  });
  const [editorOptions, setEditorOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(() => getCachedAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES) ?? []);
  const [terminalOptions, setTerminalOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(() => {
    const cached = getCachedAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES);
    return cached
      ? cached.filter((item) => !SYSTEM_TERMINAL_IDS.has(item.id))
      : [];
  });
  const systemDefaultLabels = useMemo(() => getSystemDefaultLabels(), []);

  return {
    fileManagerOptions,
    setFileManagerOptions,
    editorOptions,
    setEditorOptions,
    terminalOptions,
    setTerminalOptions,
    systemDefaultLabels,
  };
}

export function useLocalFolderOpenAppDetection({
  setFileManagerOptions,
  setEditorOptions,
  setTerminalOptions,
}: Pick<
  SettingsLocalFolderBindings,
  "setFileManagerOptions" | "setEditorOptions" | "setTerminalOptions"
>) {
  useEffect(() => {
    let cancelled = false;

    const applyAvailableApps = (
      fileManagers: LocalFolderOpenAppCandidate[],
      editors: LocalFolderOpenAppCandidate[],
      terminals: LocalFolderOpenAppCandidate[],
    ) => {
      setFileManagerOptions(
        fileManagers.filter((item) => !SYSTEM_FILE_MANAGER_IDS.has(item.id)),
      );
      setEditorOptions(editors);
      setTerminalOptions(
        terminals.filter((item) => !SYSTEM_TERMINAL_IDS.has(item.id)),
      );
    };

    const cachedFileManagers = getCachedAvailableOpenApps(
      LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
    );
    const cachedEditors = getCachedAvailableOpenApps(
      LOCAL_FOLDER_EDITOR_CANDIDATES,
    );
    const cachedTerminals = getCachedAvailableOpenApps(
      LOCAL_FOLDER_TERMINAL_CANDIDATES,
    );

    if (cachedFileManagers && cachedEditors && cachedTerminals) {
      applyAvailableApps(cachedFileManagers, cachedEditors, cachedTerminals);
      return () => {
        cancelled = true;
      };
    }

    const loadAvailableApps = async () => {
      const [fileManagers, editors, terminals] = await Promise.all([
        shell.listAvailableOpenApps(LOCAL_FOLDER_FILE_MANAGER_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES),
      ]);

      if (cancelled) return;
      applyAvailableApps(fileManagers, editors, terminals);
    };

    void loadAvailableApps();

    return () => {
      cancelled = true;
    };
  }, []);
}
