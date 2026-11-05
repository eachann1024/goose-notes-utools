export interface ParsedHiddenFolderRule {
  raw: string;
  kind: "exact" | "regex";
  pattern: string;
  flags: "" | "i";
  regex?: RegExp;
  error?: string;
}

export interface CompiledHiddenFolderMatcher {
  exactNames: Set<string>;
  regexes: RegExp[];
  matches(name: string): boolean;
}

/**
 * 解析单条隐藏文件夹规则：
 * - 普通文本：按文件夹名称精确匹配（兼容既有行为）
 * - `/pattern/` 或 `/pattern/i`：按正则表达式匹配文件夹名（仅支持 `i` 标志）
 */
export function parseHiddenFolderRule(raw: string): ParsedHiddenFolderRule {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      raw: trimmed,
      kind: "exact",
      pattern: "",
      flags: "",
      error: "请输入文件夹名称或正则表达式（如 /^\\./）",
    };
  }

  if (trimmed.startsWith("/")) {
    const lastSlashIndex = trimmed.lastIndexOf("/");
    if (lastSlashIndex <= 0) {
      return {
        raw: trimmed,
        kind: "regex",
        pattern: trimmed.slice(1),
        flags: "",
        error: "正则表达式缺少闭合的 `/`（如 `/^\\./` 或 `/^temp/i`）",
      };
    }

    const pattern = trimmed.slice(1, lastSlashIndex);
    const rawFlags = trimmed.slice(lastSlashIndex + 1);

    if (!pattern) {
      return {
        raw: trimmed,
        kind: "regex",
        pattern: "",
        flags: "",
        error: "正则表达式内容不能为空",
      };
    }

    if (rawFlags !== "" && rawFlags !== "i") {
      return {
        raw: trimmed,
        kind: "regex",
        pattern,
        flags: "",
        error: `不支持的正则标志 "${rawFlags}"，仅支持 /pattern/ 或 /pattern/i`,
      };
    }

    try {
      const regex = new RegExp(pattern, rawFlags);
      return {
        raw: trimmed,
        kind: "regex",
        pattern,
        flags: rawFlags,
        regex,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        raw: trimmed,
        kind: "regex",
        pattern,
        flags: rawFlags,
        error: `无效的正则表达式：${detail}`,
      };
    }
  }

  return {
    raw: trimmed,
    kind: "exact",
    pattern: trimmed,
    flags: "",
  };
}

/**
 * 预编译隐藏文件夹规则集合，避免扫描与 watch 过程中对每个目录重复解析或重编译 RegExp。
 * 历史异常值（如非法正则或非字符串项）会被安全忽略，不会抛错崩溃，也不会降级为扩大匹配。
 */
export function compileHiddenFolderMatcher(
  rules: Iterable<string> = [],
): CompiledHiddenFolderMatcher {
  const exactNames = new Set<string>();
  const regexes: RegExp[] = [];

  for (const item of rules) {
    if (typeof item !== "string") continue;
    const parsed = parseHiddenFolderRule(item);
    if (parsed.error || !parsed.raw) continue;
    if (parsed.kind === "regex" && parsed.regex) {
      regexes.push(parsed.regex);
    } else if (parsed.kind === "exact") {
      exactNames.add(parsed.pattern);
    }
  }

  return {
    exactNames,
    regexes,
    matches(name: string): boolean {
      if (exactNames.has(name)) return true;
      for (let i = 0; i < regexes.length; i++) {
        if (regexes[i].test(name)) return true;
      }
      return false;
    },
  };
}

export function isHiddenFolderMatcher(
  input: unknown,
): input is CompiledHiddenFolderMatcher {
  return (
    typeof input === "object" &&
    input !== null &&
    "matches" in input &&
    typeof (input as CompiledHiddenFolderMatcher).matches === "function"
  );
}
