import type * as React from "react";
import { type LocalFolderOpenAppCandidate } from "@/lib/local-folder-open-apps";

export interface SettingsLocalFolderBindings {
  setLocalFolderHiddenFolders: (folders: string[]) => void;
  hiddenFoldersRefreshNonceRef: React.RefObject<number>;
  setFileManagerOptions: React.Dispatch<
    React.SetStateAction<LocalFolderOpenAppCandidate[]>
  >;
  setEditorOptions: React.Dispatch<
    React.SetStateAction<LocalFolderOpenAppCandidate[]>
  >;
  setTerminalOptions: React.Dispatch<
    React.SetStateAction<LocalFolderOpenAppCandidate[]>
  >;
}
