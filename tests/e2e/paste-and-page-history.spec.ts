import { expect, test, type Page } from "playwright/test";

const imageNodeViewErrors = new WeakMap<Page, string[]>();

async function createNote(page: Page, title: string) {
  return page.evaluate(async (title) => {
    const w = window as any;
    const path = `/mock-notes/${title}.md`;
    w.__gooseTest.setMockFile(path, title);
    await w.__gooseTest.stores.usePages.getState().loadLocalFolderPages(w.__historyNotebook, "/mock-notes");
    const note = Object.values(w.__gooseTest.stores.usePages.getState().pages)
      .find((p: any) => p.localFilePath === path && p.workspaceId === w.__historyNotebook) as any;
    return note.id as string;
  }, title);
}

async function openNote(page: Page, id: string) {
  await page.evaluate((id) => (window as any).__GOOSE_TEST__.openPermanentTab(id, true), id);
  await expect(page.getByRole("region", { name: id, exact: true }).locator('.bn-editor')).toBeVisible();
}

async function focusBody(page: Page, id: string) {
  await page.getByRole("region", { name: id, exact: true }).locator('.bn-inline-content').first().click();
  await page.evaluate((id) => {
    const e = (window as any).__gooseNoteEditor;
    e.setTextCursorPosition(e.document[0], "end");
    e.focus();
  }, id);
}

async function text(page: Page) {
  return page.evaluate(() => (window as any).__gooseNoteEditor.prosemirrorState.doc.textContent);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  imageNodeViewErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Cannot find node position")) {
      errors.push(message.text());
    }
  });

  await page.addInitScript(() => { (window as any).__GOOSE_E2E__ = true; });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() => (window as any).__GOOSE_TEST__?.getPagesState().hydrated);
  await page.evaluate(async () => {
    const w = window as any;
    w.__historyNotebook = (await w.__gooseTest.setupMockNotebook()).notebookId;
  });
});

test("系统 Cmd+C/V 跨笔记复制待办内图片，保留 children、宽度且不复用源 ID", async ({ page }) => {
  const a = await createNote(page, "复制来源");
  const b = await createNote(page, "粘贴目标");
  // 写入模拟磁盘加载后的页面内容，再首次打开源页；避免 replaceBlocks 即时重建
  // NodeView 的夹具竞态，复制路径与用户已有笔记一致。
  await page.evaluate((a) => {
    const sourceContent = [
      {
        id: "source-todo",
        type: "checkListItem",
        props: { checked: true },
        content: "保留层级的待办",
        children: [{
          id: "source-image",
          type: "image",
          props: {
            name: "image.png",
            url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgNDAwIDIwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM2YmJmNTkiLz48L3N2Zz4=",
            previewWidth: 176,
            caption: "",
          },
        }, {
          id: "source-legacy-default-caption",
          type: "image",
          props: {
            name: "image.png",
            url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgNDAwIDIwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM2YmJmNTkiLz48L3N2Zz4=",
            previewWidth: 100,
            caption: "image.png",
          },
        }, {
          id: "source-captioned-image",
          type: "image",
          props: {
            name: "image.png",
            url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgNDAwIDIwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM2YmJmNTkiLz48L3N2Zz4=",
            previewWidth: 120,
            caption: "用户明确填写的说明",
          },
        }],
      },
      { id: "source-tail", type: "paragraph", content: "复制范围的末尾块" },
    ];
    const store = (window as any).__gooseTest.stores.usePages;
    store.setState((state: any) => ({
      pages: { ...state.pages, [a]: { ...state.pages[a], content: sourceContent } },
    }));
  }, a);
  await openNote(page, a);
  await page.evaluate(() => {
    const e = (window as any).__gooseNoteEditor;
    e.setSelection(e.document[0], e.document.at(-1));
    e.focus();
  });
  await page.keyboard.press("ControlOrMeta+c");
  await openNote(page, b);
  await focusBody(page, b);
  await page.keyboard.press("ControlOrMeta+v");
  await expect.poll(() => page.evaluate(() => {
    const doc = (window as any).__gooseNoteEditor.document;
    const todo = doc.find((b: any) => b.type === "checkListItem");
    const [image, legacyDefaultCaptionImage, captionedImage] = todo?.children?.filter((b: any) => b.type === "image") ?? [];
    return {
      checked: todo?.props.checked,
      rootImageCount: doc.filter((b: any) => b.type === "image").length,
      todoId: todo?.id,
      childId: image?.id,
      childCount: todo?.children?.length ?? 0,
      previewWidth: image?.props.previewWidth,
      url: image?.props.url,
      caption: image?.props.caption,
      legacyDefaultCaptionId: legacyDefaultCaptionImage?.id,
      legacyDefaultCaption: legacyDefaultCaptionImage?.props.caption,
      captionedImageId: captionedImage?.id,
      captionedImageCaption: captionedImage?.props.caption,
    };
  })).toEqual({
    checked: true,
    rootImageCount: 0,
    todoId: expect.not.stringMatching(/^source-todo$/),
    childId: expect.not.stringMatching(/^source-image$/),
    childCount: 3,
    previewWidth: 176,
    url: expect.stringMatching(/^data:image[/]/),
    caption: "",
    legacyDefaultCaptionId: expect.not.stringMatching(/^source-legacy-default-caption$/),
    legacyDefaultCaption: "",
    captionedImageId: expect.not.stringMatching(/^source-captioned-image$/),
    captionedImageCaption: "用户明确填写的说明",
  });
  const image = page.getByRole("region", { name: b, exact: true }).locator('.bn-editor [data-content-type="image"] img').first();
  await expect(image).toBeVisible();
  await expect.poll(async () => Math.round((await image.boundingBox())?.width ?? 0)).toBe(176);
  await expect(page.locator('.bn-editor')).not.toContainText("image.png");
  expect(imageNodeViewErrors.get(page)).toEqual([]);
});

