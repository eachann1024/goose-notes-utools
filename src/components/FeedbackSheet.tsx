import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { X, ImagePlus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GripTextarea, gripPaint } from "@/components/ui/grip-textarea";
import { textareaClass } from "@/components/ui/textarea";
import { hostRuntime } from "@/lib/host";
import {
  feedbackFetch,
  feedbackToken,
  loadFeedback,
  type FeedbackMessage,
} from "@/lib/feedback";

const drafts = new Map<
  string,
  {
    message: string;
    contact: string;
    images: File[];
    video: File | null;
    requestId: string;
  }
>();
function Attachment({
  messageId,
  file,
}: {
  messageId: string;
  file: FeedbackMessage["files"][number];
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFailed(false);
    setUrl("");
    const controller = new AbortController();
    let objectUrl = "";
    void (async () => {
      try {
        const response = await feedbackFetch(
          `/api/media/${messageId}/${file.index}`,
          { signal: controller.signal },
          120000,
        );
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId, file.index, attempt]);
  if (!url)
    return failed ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setAttempt((value) => value + 1)}
      >
        附件加载失败，重试
      </Button>
    ) : (
      <span className="block text-sm">正在加载附件…</span>
    );
  return file.kind === "video" ? (
    <video
      src={url}
      controls
      className="max-h-56 max-w-full rounded-md"
      aria-label={file.name}
    />
  ) : (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        src={url}
        alt={file.name}
        className="max-h-56 max-w-full rounded-md"
      />
    </a>
  );
}

export function FeedbackSheet({
  project,
  onClose,
}: {
  project: string;
  onClose: () => void;
}) {
  const saved = drafts.get(project);
  const [message, setMessage] = useState(saved?.message || "");
  const [contact, setContact] = useState(saved?.contact || "");
  const [images, setImages] = useState<File[]>(saved?.images || []);
  const [video, setVideo] = useState<File | null>(saved?.video || null);
  const requestId = useRef(saved?.requestId || crypto.randomUUID());
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const followLatest = useRef(false);
  const revealSent = useRef(false);
  useLayoutEffect(() => {
    const root = viewport.current;
    if (root && (revealSent.current || followLatest.current)) {
      root.scrollTop = root.scrollHeight;
      revealSent.current = false;
      followLatest.current = true;
    }
  }, [messages]);
  const messageNodes = useRef(new Map<string, HTMLDivElement>());
  const seen = useRef(new Set<string>());
  const marking = useRef(false);
  const [readRetry, setReadRetry] = useState(0);
  const draft = useRef({
    message,
    contact,
    images,
    video,
    requestId: requestId.current,
  });
  draft.current = {
    message,
    contact,
    images,
    video,
    requestId: requestId.current,
  };
  function changed() {
    requestId.current = crypto.randomUUID();
  }
  useEffect(
    () => () => {
      drafts.set(project, draft.current);
      controller.current?.abort();
    },
    [project],
  );
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const result = await loadFeedback(project, abort.signal);
        if (active) {
          setMessages(result.messages);
          setStatus("");
        }
      } catch (error) {
        if (active)
          setStatus(
            error instanceof Error ? error.message : "加载失败，请稍后重试",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [project]);
  useEffect(() => {
    const root = viewport.current;
    if (!root) return;
    let active = true;
    const mark = async () => {
      if (
        marking.current ||
        document.visibilityState !== "visible" ||
        !document.hasFocus()
      )
        return;
      let last: FeedbackMessage | undefined;
      // Only acknowledge the contiguous prefix actually displayed in the viewport.
      for (const entry of messages) {
        if (!seen.current.has(entry.id)) break;
        last = entry;
      }
      if (!last || root.dataset.read === last.id) return;
      marking.current = true;
      try {
        await feedbackFetch("/api/conversation/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, messageId: last.id }),
        });
        if (active) {
          root.dataset.read = last.id;
          await loadFeedback(project);
        }
      } catch {
        /* Keep unread until the server accepts acknowledgement. */
      } finally {
        marking.current = false;
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (document.visibilityState !== "visible" || !document.hasFocus())
          return;
        for (const entry of entries)
          if (
            entry.isIntersecting &&
            entry.target instanceof HTMLElement &&
            entry.target.dataset.messageId
          )
            seen.current.add(entry.target.dataset.messageId);
        void mark();
      },
      { root, threshold: 0.01 },
    );
    messageNodes.current.forEach((node) => observer.observe(node));
    const focused = () => {
      observer.disconnect();
      messageNodes.current.forEach((node) => observer.observe(node));
      void mark();
    };
    window.addEventListener("focus", focused);
    document.addEventListener("visibilitychange", focused);
    const retry = setInterval(() => {
      void mark();
    }, 10000);
    return () => {
      active = false;
      observer.disconnect();
      clearInterval(retry);
      window.removeEventListener("focus", focused);
      document.removeEventListener("visibilitychange", focused);
    };
  }, [messages, project, readRetry]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sendingRef.current) return;
    if (!message.trim()) {
      setStatus("请输入消息");
      return;
    }
    if (images.some((file) => file.size > 20 * 1024 * 1024)) {
      setStatus("单张图片不能超过 20MB");
      return;
    }
    if (video && video.size > 200 * 1024 * 1024) {
      setStatus("视频不能超过 200MB");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setStatus("");
    controller.current = new AbortController();
    try {
      const body = new FormData();
      body.set("project", project);
      body.set("token", feedbackToken());
      body.set("requestId", requestId.current);
      body.set("message", message.trim());
      body.set("contact", contact.trim());
      body.set("leave_blank", "");
      const username = hostRuntime.getUser()?.nickname;
      if (username) body.set("username", username);
      images.forEach((file) => body.append("images", file));
      if (video) body.set("video", video);
      const response = await feedbackFetch(
        "/api/feedback",
        { method: "POST", body, signal: controller.current.signal },
        120000,
      );
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!result.ok) throw new Error(result.error || "发送失败，请稍后重试");
      changed();
      draft.current = {
        message: "",
        contact,
        images: [],
        video: null,
        requestId: requestId.current,
      };
      drafts.set(project, draft.current);
      setMessage("");
      setImages([]);
      setVideo(null);
      revealSent.current = true;
      const conversation = await loadFeedback(
        project,
        controller.current.signal,
      );
      setMessages(conversation.messages);
      setReadRetry((value) => value + 1);
    } catch (error) {
      if (!controller.current.signal.aborted)
        setStatus(
          error instanceof Error ? error.message : "网络不通，请稍后重试",
        );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="px-5 py-4">
          <DialogTitle>反馈</DialogTitle>
        </DialogHeader>
        <div
          ref={viewport}
          onScroll={(event) => {
            const root = event.currentTarget;
            followLatest.current =
              root.scrollHeight - root.scrollTop - root.clientHeight < 40;
          }}
          className="min-h-48 flex-1 space-y-4 overflow-y-auto bg-muted/40 p-5"
          style={{ maxHeight: "45vh" }}
          aria-label="反馈聊天记录"
          role="log"
        >
          {!messages.length ? (
            <p className="py-10 text-center text-muted-foreground">
              {loading
                ? "正在加载…"
                : "遇到的问题或想要的功能，都可以在这里告诉我们。"}
            </p>
          ) : (
            messages.map((entry) => (
              <div
                key={entry.id}
                data-message-id={entry.id}
                ref={(node) => {
                  if (node) messageNodes.current.set(entry.id, node);
                  else messageNodes.current.delete(entry.id);
                }}
                className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] space-y-2 rounded-xl px-4 py-3 ${entry.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-background text-foreground"}`}
                >
                  <time
                    dateTime={entry.at}
                    className={`block text-xs ${entry.role === "user" ? "text-primary-foreground/75" : "text-muted-foreground"}`}
                  >
                    {new Date(entry.at).toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {entry.message}
                  </p>
                  {entry.files.map((file) => (
                    <Attachment
                      key={file.index}
                      messageId={entry.id}
                      file={file}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <form className="grid gap-3 p-4" onSubmit={submit}>
          <GripTextarea
            className={textareaClass}
            paint={gripPaint.goose}
            gripLabel="反馈内容"
            minHeight={112}
            aria-label="反馈内容"
            placeholder="输入消息…"
            value={message}
            maxLength={4000}
            disabled={sending}
            onChange={(event) => {
              changed();
              setMessage(event.target.value);
            }}
          />
          <Input
            aria-label="邮箱，选填"
            placeholder="邮箱，选填"
            type="email"
            value={contact}
            disabled={sending}
            onChange={(event) => {
              changed();
              setContact(event.target.value);
            }}
          />
          {images.length > 0 || video ? (
            <div className="flex flex-wrap gap-2">
              {images.map((file, index) => (
                <Button
                  key={`${file.name}-${index}`}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={sending}
                  onClick={() => {
                    changed();
                    setImages(images.filter((_, i) => i !== index));
                  }}
                >
                  {file.name}
                  <X className="h-3 w-3" />
                </Button>
              ))}
              {video ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={sending}
                  onClick={() => {
                    changed();
                    setVideo(null);
                  }}
                >
                  {video.name}
                  <X className="h-3 w-3" />
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={sending}
              onClick={() => imageRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              图片
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={sending}
              onClick={() => videoRef.current?.click()}
            >
              <Video className="h-4 w-4" />
              视频
            </Button>
            <Button className="ml-auto" type="submit" disabled={sending}>
              {sending ? "发送中…" : "发送"}
            </Button>
          </div>
          <Input
            ref={imageRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            aria-label="图片，最多 4 张，每张 20MB"
            onChange={(event) => {
              changed();
              setImages(Array.from(event.target.files || []).slice(0, 4));
              event.target.value = "";
            }}
          />
          <Input
            ref={videoRef}
            className="sr-only"
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            aria-label="视频，1 个，最大 200MB"
            onChange={(event) => {
              changed();
              setVideo(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
          {status ? (
            <p role="status" className="text-sm text-destructive">
              {status}
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
