import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

import { jsonContentToMarkdown } from "./markdown/serialize";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { sanitizeRenderedSvg } from "@/lib/notebook-ai/svgSanitizer";

/**
 * 把 <pre><code class="language-mermaid">...</code></pre> 转成
 * <pre class="mermaid">...</pre>，便于浏览器侧 mermaid.js 自动渲染。
 */
function rehypeMermaid() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node) return;
      if (
        node.type === "element" &&
        node.tagName === "pre" &&
        Array.isArray(node.children)
      ) {
        const code = node.children.find(
          (c: any) => c && c.type === "element" && c.tagName === "code",
        );
        const cls = code?.properties?.className;
        const isMermaid =
          Array.isArray(cls) && cls.some((c: any) => c === "language-mermaid");
        if (isMermaid) {
          const text = (code.children || [])
            .map((c: any) => (typeof c?.value === "string" ? c.value : ""))
            .join("");
          node.tagName = "pre";
          node.properties = { className: ["mermaid"] };
          node.children = [{ type: "text", value: text }];
          return;
        }
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);
  };
}

const htmlPipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex)
  .use(rehypeHighlight, { detect: true, ignoreMissing: true })
  .use(rehypeMermaid)
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function blocksToMarkdown(
  blocks: BlockNoteContent,
): Promise<string> {
  return jsonContentToMarkdown(blocks);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

async function renderPreMermaidBlocksToSvg(html: string): Promise<string> {
  const mermaidBlockRe = /<pre class="mermaid">([\s\S]*?)<\/pre>/g;
  if (!mermaidBlockRe.test(html)) return html;

  try {
    const { renderMermaidSvgForExport } = await import(
      "@/lib/imageExport/mermaid"
    );
    mermaidBlockRe.lastIndex = 0;
    const matches = [...html.matchAll(mermaidBlockRe)];
    let nextHtml = html;
    for (const match of matches) {
      const fullTag = match[0];
      const source = decodeHtmlEntities(match[1] ?? "").trim();
      if (!source) continue;
      try {
        const svg = await renderMermaidSvgForExport(source, "light");
        const safeSvg = sanitizeRenderedSvg(svg);
        if (safeSvg) {
          nextHtml = nextHtml.replace(
            fullTag,
            `<div class="goose-export-mermaid" style="display:flex;justify-content:center;overflow-x:auto;">${safeSvg}</div>`,
          );
        }
      } catch {
        // 单块渲染失败时保留原始 <pre class="mermaid"> 源码
      }
    }
    return nextHtml;
  } catch {
    return html;
  }
}

export async function blocksToHTML(
  blocks: BlockNoteContent,
): Promise<string> {
  const md = jsonContentToMarkdown(blocks);
  const file = await htmlPipeline.process(md);
  return renderPreMermaidBlocksToSvg(String(file));
}

/**
 * 导出 HTML 样式已通过 getExportHtmlCss() 随包本地内联，不再请求外部 CDN。
 */
export const EXPORT_HTML_HEAD_ASSETS = "";

export const EXPORT_HTML_BODY_SCRIPTS = "";
