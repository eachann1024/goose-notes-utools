import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { EditorSettings } from "@/components/editor/platform/hostContext";

export function useEditorTheme({
  theme,
  setEffectiveTheme,
}: {
  theme: EditorSettings["theme"];
  setEffectiveTheme: Dispatch<SetStateAction<"light" | "dark">>;
}) {
  useEffect(() => {
    const resolve = () => {
      if (theme === "dark") {
        setEffectiveTheme("dark");
        return;
      }
      if (theme === "system") {
        setEffectiveTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        return;
      }
      setEffectiveTheme("light");
    };
    resolve();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => resolve();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);
}
