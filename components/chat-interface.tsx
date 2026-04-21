"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { resolveFeedbackValue, type FeedbackValue } from "@/lib/chat-feedback";
import type { Market } from "@/lib/chat-memory";
import {
  deriveThreadTitle,
  getMessagesSignature,
  getMessageText,
} from "@/lib/chat-threads";
import {
  CHAT_UI_COPY,
  CHAT_UI_THEME,
  buildThreadMetaLabel,
} from "@/lib/chat-ui-theme";

type ChatThread = {
  feedbackByMessageId?: Record<string, FeedbackValue | undefined>;
  id: string;
  market: Market;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

const THREADS_STORAGE_KEY = "mei-ai.chat.threads";
const ACTIVE_THREAD_STORAGE_KEY = "mei-ai.chat.active-thread";

const SUGGESTION_PROJECTS = [
  "玻尿酸",
  "乔雅登",
  "少女针",
  "热玛吉",
  "超声炮",
  "光子嫩肤",
  "水光",
  "鼻基底填充",
  "下颌线紧致",
  "面部抗衰",
] as const;

const SUGGESTION_CHANNELS = [
  "朋友圈",
  "海报",
  "项目单页",
  "新品首发图",
  "诊所橱窗屏",
  "活动主视觉",
] as const;

const SUGGESTION_TONES = [
  "更高级一点",
  "更克制一点",
  "更像高端杂志副标题",
  "更像诊所疗程手册",
  "更有高级松弛感",
  "更有国际审美感",
] as const;

const SUGGESTION_PLATFORMS = [
  "小红书风格",
  "朋友圈风格",
  "情人节语境",
  "夏日焕新语境",
  "秋冬抗衰语境",
] as const;

function pickRandom<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function isNearBottom(node: HTMLDivElement, threshold = 120) {
  return (
    node.scrollHeight - node.scrollTop - node.clientHeight <= threshold
  );
}

function inferMarketFromPrompt(text: string): Market {
  const normalized = text.toLowerCase();

  if (
    /\bhk\b|hong kong|香港|繁体|繁體|港风|港風|診所|療程|透明質酸|juvederm|thermage|ultraformer/.test(
      normalized,
    )
  ) {
    return "HK";
  }

  return "CN";
}

function generateSuggestionBatch(market: Market) {
  const suggestions = new Set<string>();
  const useTraditional = market === "HK";

  while (suggestions.size < 4) {
    const slot = suggestions.size;
    const project = pickRandom(SUGGESTION_PROJECTS);

    if (slot === 0) {
      suggestions.add(
        useTraditional
          ? `寫一條${project}${pickRandom(SUGGESTION_CHANNELS)}廣告文案`
          : `写一条${project}${pickRandom(SUGGESTION_CHANNELS)}广告文案`,
      );
      continue;
    }

    if (slot === 1) {
      suggestions.add(
        useTraditional
          ? `寫一條${project}${pickRandom(SUGGESTION_CHANNELS)}標題和正文`
          : `写一条${project}${pickRandom(SUGGESTION_CHANNELS)}标题和正文`,
      );
      continue;
    }

    if (slot === 2) {
      suggestions.add(
        useTraditional
          ? `把這句${project}文案改得${pickRandom(SUGGESTION_TONES)}`
          : `把这句${project}文案改得${pickRandom(SUGGESTION_TONES)}`,
      );
      continue;
    }

    suggestions.add(
      useTraditional
        ? `給我一版${pickRandom(SUGGESTION_PLATFORMS)}的${project}文案`
        : `给我一版${pickRandom(SUGGESTION_PLATFORMS)}的${project}文案`,
    );
  }

  return [...suggestions];
}

function createThread(): ChatThread {
  const now = Date.now();
  return {
    id: `mei_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    market: "CN",
    title: "新对话",
    updatedAt: now,
    feedbackByMessageId: {},
    messages: [],
  };
}

function Sidebar({
  activeThreadId,
  onDeleteThread,
  onNewChat,
  onSelectThread,
  threads,
}: {
  activeThreadId: string;
  onDeleteThread: (threadId: string) => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  threads: ChatThread[];
}) {
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);

  useEffect(() => {
    const closeMenu = () => setMenuThreadId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  return (
    <aside
      className="flex h-full flex-col border-r"
      style={{
        background: CHAT_UI_THEME.sidebarSurface,
        borderColor: CHAT_UI_THEME.sidebarBorder,
      }}
    >
      <div className="p-3">
        <div
          className="mb-3 px-1 text-[15px] font-medium"
          style={{ color: CHAT_UI_THEME.textPrimary }}
        >
          Mei AI
        </div>
        <button
          className="flex h-11 w-full items-center justify-start gap-3 rounded-2xl border px-4 text-[14px] font-medium transition hover:bg-white/90"
          onClick={onNewChat}
          style={{
            background: CHAT_UI_THEME.mainSurface,
            borderColor: CHAT_UI_THEME.border,
            color: CHAT_UI_THEME.textPrimary,
          }}
          type="button"
        >
          <span className="text-[18px] leading-none">+</span>
          新建聊天
        </button>
      </div>

      <div
        className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: CHAT_UI_THEME.textTertiary }}
      >
        最近
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="space-y-1">
          {threads.map((thread) => {
            const active = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                className={[
                  "group flex items-start gap-2 rounded-2xl px-3 py-3 transition",
                  active
                    ? "bg-white shadow-[0_8px_24px_rgba(23,23,23,0.06)]"
                    : "hover:bg-white/60",
                ].join(" ")}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelectThread(thread.id)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelectThread(thread.id);
                  }}
                  type="button"
                >
                  <div
                    className="truncate text-[14px] font-medium leading-5"
                    style={{ color: CHAT_UI_THEME.textPrimary }}
                  >
                    {thread.title}
                  </div>
                  <div
                    className="mt-0.5 text-[12px] leading-4"
                    style={{ color: CHAT_UI_THEME.textTertiary }}
                  >
                    {buildThreadMetaLabel(thread.updatedAt)}
                  </div>
                </button>

                <div className="relative shrink-0">
                  <button
                    aria-label="更多操作"
                    className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[16px] opacity-0 transition group-hover:opacity-100 hover:bg-black/5"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuThreadId((current) =>
                        current === thread.id ? null : thread.id,
                      );
                    }}
                    style={{ color: CHAT_UI_THEME.textSecondary }}
                    type="button"
                  >
                    …
                  </button>

                  {menuThreadId === thread.id ? (
                    <div
                      className="absolute right-0 top-8 z-20 min-w-[120px] overflow-hidden rounded-xl border bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
                      onClick={(event) => event.stopPropagation()}
                      style={{ borderColor: CHAT_UI_THEME.border }}
                    >
                      <button
                        className="flex w-full items-center px-3 py-2 text-left text-[13px] transition hover:bg-[#f5f5f5]"
                        onClick={() => {
                          setMenuThreadId(null);
                          onDeleteThread(thread.id);
                        }}
                        style={{ color: "#b42318" }}
                        type="button"
                      >
                        删除对话
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="relative max-w-[85%] rounded-[28px] px-5 py-3 text-[15px] leading-7 shadow-[0_10px_30px_rgba(23,23,23,0.05)] md:max-w-[72%]"
        style={{
          background: "#ffffff",
          color: CHAT_UI_THEME.textPrimary,
          border: `1px solid ${CHAT_UI_THEME.border}`,
        }}
      >
        <div className="whitespace-pre-wrap break-words">{text}</div>
      </div>
    </div>
  );
}

function FeedbackButton({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-full border px-3 py-1 text-[12px] transition disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: active ? CHAT_UI_THEME.accentSoft : "transparent",
        borderColor: active ? CHAT_UI_THEME.textPrimary : CHAT_UI_THEME.border,
        color: active ? CHAT_UI_THEME.textPrimary : CHAT_UI_THEME.textSecondary,
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="w-full">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
            style={{
              background: CHAT_UI_THEME.accent,
              color: CHAT_UI_THEME.textOnDark,
            }}
          >
            M
          </div>
          <div
            className="text-[13px] font-medium tracking-[0.02em]"
            style={{ color: CHAT_UI_THEME.textSecondary }}
          >
            Mei AI
          </div>
        </div>

        <div
          className="inline-flex items-center gap-3 rounded-full border bg-white px-4 py-3 shadow-[0_12px_30px_rgba(23,23,23,0.04)]"
          style={{ borderColor: CHAT_UI_THEME.border }}
        >
          <div className="thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div
            className="text-[14px]"
            style={{ color: CHAT_UI_THEME.textSecondary }}
          >
            {CHAT_UI_COPY.loadingLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

const AssistantBubble = memo(function AssistantBubble({
  copied,
  feedback,
  feedbackPending,
  onFeedback,
  onCopy,
  text,
}: {
  copied: boolean;
  feedback: FeedbackValue | null | undefined;
  feedbackPending: boolean;
  onFeedback: (value: FeedbackValue) => void;
  onCopy: () => void;
  text: string;
}) {
  return (
    <div className="flex justify-start">
      <div className="w-full">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
            style={{
              background: CHAT_UI_THEME.accent,
              color: CHAT_UI_THEME.textOnDark,
            }}
          >
            M
          </div>
          <div
            className="text-[13px] font-medium tracking-[0.02em]"
            style={{ color: CHAT_UI_THEME.textSecondary }}
          >
            Mei AI
          </div>
        </div>
        <div
          className="relative rounded-[30px] border bg-white px-5 py-5 text-[15px] leading-8 shadow-[0_18px_48px_rgba(23,23,23,0.05)]"
          style={{
            color: CHAT_UI_THEME.textPrimary,
            borderColor: CHAT_UI_THEME.border,
          }}
        >
          <div className="whitespace-pre-wrap break-words">{text}</div>

          <button
            className="absolute bottom-4 right-4 inline-flex h-8 items-center rounded-full border bg-white/96 px-3 text-[12px] font-medium transition hover:bg-[#f8f8f8]"
            onClick={onCopy}
            style={{
              borderColor: CHAT_UI_THEME.border,
              color: copied
                ? CHAT_UI_THEME.textPrimary
                : CHAT_UI_THEME.textSecondary,
            }}
            type="button"
          >
            {copied ? "已复制" : "复制"}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <FeedbackButton
            active={feedback === "up"}
            disabled={feedbackPending}
            onClick={() => onFeedback("up")}
          >
            满意
          </FeedbackButton>
          <FeedbackButton
            active={feedback === "down"}
            disabled={feedbackPending}
            onClick={() => onFeedback("down")}
          >
            不满意
          </FeedbackButton>
        </div>
      </div>
    </div>
  );
});

function MessageRow({
  feedback,
  feedbackPending,
  message,
  onFeedback,
}: {
  feedback: FeedbackValue | null | undefined;
  feedbackPending: boolean;
  message: UIMessage;
  onFeedback: (message: UIMessage, value: FeedbackValue) => void;
}) {
  const text = getMessageText(message);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  if (!text) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 1600);
    } catch (error) {
      console.error("copy message failed", error);
    }
  };

  if (message.role === "user") {
    return <UserBubble text={text} />;
  }

  return (
    <AssistantBubble
      copied={copied}
      feedback={feedback}
      feedbackPending={feedbackPending}
      onFeedback={(value) => onFeedback(message, value)}
      onCopy={handleCopy}
      text={text}
    />
  );
}

function EmptyState({
}: {
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14">
      <div className="w-full max-w-3xl text-center">
        <div
          className="mb-4 text-[12px] font-semibold uppercase tracking-[0.26em]"
          style={{ color: CHAT_UI_THEME.textTertiary }}
        >
          Mei AI
        </div>
        <div
          className="text-[34px] font-medium tracking-[-0.05em] md:text-[48px]"
          style={{ color: CHAT_UI_THEME.textPrimary }}
        >
          今天想写什么文案？
        </div>
      </div>
    </div>
  );
}

function Composer({
  error,
  input,
  loading,
  onChange,
  onStop,
  onSubmit,
  textareaRef,
}: {
  error?: Error;
  input: string;
  loading: boolean;
  onChange: (value: string) => void;
  onStop: () => void;
  onSubmit: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="sticky bottom-0 px-3 pb-4 pt-4 md:px-6 md:pb-6">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(to_top,rgba(247,247,243,1),rgba(247,247,243,0))]" />

      <div className="relative mx-auto w-full max-w-4xl">
        <form
          className="rounded-[32px] border bg-white/96 p-3 shadow-[0_18px_60px_rgba(23,23,23,0.10)] backdrop-blur"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          style={{ borderColor: CHAT_UI_THEME.border }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            placeholder={CHAT_UI_COPY.composerPlaceholder}
            className="max-h-[220px] min-h-[26px] w-full resize-none border-none bg-transparent px-3 py-3 text-[15px] leading-7 outline-none"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                onSubmit();
              }
            }}
            style={{
              color: CHAT_UI_THEME.textPrimary,
            }}
          />

          <div className="mt-2 flex items-center justify-between gap-3 px-1">
            <div
              className="text-[12px]"
              style={{ color: CHAT_UI_THEME.textTertiary }}
            >
              回车发送，Shift + 回车换行
            </div>
            {loading ? (
              <button
                className="inline-flex h-10 items-center rounded-full border px-4 text-[14px] font-medium"
                onClick={onStop}
                style={{
                  borderColor: CHAT_UI_THEME.border,
                  color: CHAT_UI_THEME.textPrimary,
                }}
                type="button"
              >
                {CHAT_UI_COPY.stopLabel}
              </button>
            ) : (
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={input.trim().length === 0}
                style={{ background: CHAT_UI_THEME.accent }}
                type="submit"
              >
                ↑
              </button>
            )}
          </div>
        </form>

        {error ? (
          <div className="mt-3 px-2 text-sm text-[#b54444]">
            {error.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChatWorkspace({
  feedbackPendingByMessageId,
  onFeedbackChange,
  onMessagesChange,
  onThreadMarketChange,
  onOpenSidebar,
  thread,
}: {
  feedbackPendingByMessageId: Record<string, boolean>;
  onFeedbackChange: (
    threadId: string,
    message: UIMessage,
    value: FeedbackValue,
  ) => Promise<void>;
  onMessagesChange: (threadId: string, messages: UIMessage[]) => void;
  onThreadMarketChange: (threadId: string, market: Market) => void;
  onOpenSidebar: () => void;
  thread: ChatThread;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(() =>
    generateSuggestionBatch("CN"),
  );
  const [suggestionBatchKey, setSuggestionBatchKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastEmittedSignatureRef = useRef(getMessagesSignature(thread.messages));
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const shouldStickToBottomRef = useRef(true);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ sessionId: thread.id }),
      }),
    [thread.id],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: thread.id,
    messages: thread.messages,
    onFinish: ({ messages: completedMessages }) => {
      onMessagesChange(thread.id, completedMessages);
    },
    transport,
  });

  const loading = status === "submitted" || status === "streaming";
  const messagesSignature = getMessagesSignature(messages);

  useEffect(() => {
    lastEmittedSignatureRef.current = getMessagesSignature(thread.messages);
    setInput("");
    setSuggestions(generateSuggestionBatch("CN"));
    setSuggestionBatchKey(0);

    const node = textareaRef.current;
    if (!node) return;

    requestAnimationFrame(() => {
      node.focus();
      node.style.height = "0px";
      node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
    });
  }, [thread.id, thread.messages]);

  useEffect(() => {
    if (messagesSignature === lastEmittedSignatureRef.current) return;

    lastEmittedSignatureRef.current = messagesSignature;
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(
      () => {
        onMessagesChange(thread.id, messages);
        persistTimeoutRef.current = null;
      },
      loading ? 720 : 120,
    );
  }, [messages, messagesSignature, onMessagesChange, thread.id]);

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
  }, [input]);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;

    const handleScroll = () => {
      shouldStickToBottomRef.current = isNearBottom(node);
    };

    handleScroll();
    node.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      node.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const node = scrollContainerRef.current;
    const marker = messagesEndRef.current;
    if (!node || !marker || !shouldStickToBottomRef.current) return;

    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
      scrollFrameRef.current = null;
    });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const submit = () => {
    const value = input.trim();
    if (!value || loading) return;
    onThreadMarketChange(thread.id, inferMarketFromPrompt(value));
    void sendMessage({ text: value });
    setInput("");
  };

  const submitSuggestion = (value: string) => {
    if (loading) return;
    onThreadMarketChange(thread.id, inferMarketFromPrompt(value));
    void sendMessage({ text: value });
  };

  const refreshSuggestions = () => {
    if (loading) return;
    setSuggestions(generateSuggestionBatch("CN"));
    setSuggestionBatchKey((current) => current + 1);
  };

  return (
    <div
      className="flex min-w-0 flex-1 flex-col"
      style={{ background: CHAT_UI_THEME.mainSurface }}
    >
      <header
        className="flex h-16 items-center justify-between border-b px-4 md:px-6"
        style={{ borderColor: CHAT_UI_THEME.border }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-white lg:hidden"
            onClick={onOpenSidebar}
            style={{
              borderColor: CHAT_UI_THEME.border,
              color: CHAT_UI_THEME.textSecondary,
            }}
            type="button"
          >
            ☰
          </button>
          <div className="min-w-0">
            <div
              className="truncate text-[15px] font-medium"
              style={{ color: CHAT_UI_THEME.textPrimary }}
            >
              {thread.title}
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex-1 overflow-y-auto px-3 md:px-6"
          ref={scrollContainerRef}
        >
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 py-6 md:py-8">
            {messages.length === 0 ? (
              <EmptyState onRefresh={refreshSuggestions} />
            ) : null}

            {messages.length === 0 ? (
              <div className="pb-6">
                <div className="mb-3 flex items-center justify-end">
                  <button
                    className="inline-flex h-10 items-center rounded-full border bg-white px-4 text-[13px] font-medium transition hover:bg-[#fffef9]"
                    onClick={refreshSuggestions}
                    style={{
                      borderColor: CHAT_UI_THEME.border,
                      color: CHAT_UI_THEME.textPrimary,
                    }}
                    type="button"
                  >
                    换一批
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2" key={suggestionBatchKey}>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestionBatchKey}-${suggestion}`}
                      className="suggestion-fade-card rounded-[24px] border bg-white px-5 py-4 text-left text-[14px] leading-6 shadow-[0_10px_30px_rgba(23,23,23,0.04)] transition hover:-translate-y-0.5 hover:bg-[#fffef9]"
                      onClick={() => submitSuggestion(suggestion)}
                      style={
                        {
                          borderColor: CHAT_UI_THEME.border,
                          color: CHAT_UI_THEME.textPrimary,
                          "--venetian-delay": `${index * 70}ms`,
                        } as CSSProperties
                      }
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <MessageRow
                key={message.id}
                feedback={thread.feedbackByMessageId?.[message.id]}
                feedbackPending={Boolean(
                  feedbackPendingByMessageId[message.id],
                )}
                message={message}
                onFeedback={(targetMessage, value) =>
                  onFeedbackChange(thread.id, targetMessage, value)
                }
              />
            ))}

            {loading ? <ThinkingIndicator /> : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <Composer
          error={error ?? undefined}
          input={input}
          loading={loading}
          onChange={setInput}
          onStop={stop}
          onSubmit={submit}
          textareaRef={textareaRef}
        />
      </div>
    </div>
  );
}

export function ChatInterface() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [feedbackPendingByMessageId, setFeedbackPendingByMessageId] = useState<
    Record<string, boolean>
  >({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedThreads = localStorage.getItem(THREADS_STORAGE_KEY);
      const savedActiveThreadId = localStorage.getItem(
        ACTIVE_THREAD_STORAGE_KEY,
      );
      const parsedThreads = savedThreads
        ? (JSON.parse(savedThreads) as ChatThread[])
        : [];
      const sanitizedThreads: ChatThread[] = parsedThreads
        .filter(
          (thread) => thread && thread.id && Array.isArray(thread.messages),
        )
        .map((thread) => ({
          ...thread,
          feedbackByMessageId: thread.feedbackByMessageId ?? {},
          market: thread.market === "HK" ? ("HK" as const) : ("CN" as const),
        }));

      if (sanitizedThreads.length > 0) {
        const orderedThreads = [...sanitizedThreads].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
        setThreads(orderedThreads);
        setActiveThreadId(
          orderedThreads.some((thread) => thread.id === savedActiveThreadId)
            ? (savedActiveThreadId as string)
            : orderedThreads[0].id,
        );
      } else {
        const thread = createThread();
        setThreads([thread]);
        setActiveThreadId(thread.id);
      }
    } catch {
      const thread = createThread();
      setThreads([thread]);
      setActiveThreadId(thread.id);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !activeThreadId) return;
    localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
    localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, activeThreadId);
  }, [activeThreadId, hydrated, threads]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [sidebarOpen]);

  const orderedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads],
  );

  const activeThread =
    orderedThreads.find((thread) => thread.id === activeThreadId) ??
    orderedThreads[0] ??
    null;

  const handleMessagesChange = (
    threadId: string,
    nextMessages: UIMessage[],
  ) => {
    const nextMessagesSnapshot = structuredClone(nextMessages);

    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id !== threadId
          ? thread
          : {
              ...thread,
              messages: nextMessagesSnapshot,
              title: deriveThreadTitle(nextMessagesSnapshot),
              updatedAt:
                nextMessagesSnapshot.length > 0 ? Date.now() : thread.updatedAt,
            },
      ),
    );
  };

  const handleFeedbackChange = async (
    threadId: string,
    message: UIMessage,
    value: FeedbackValue,
  ) => {
    const existingThread = threads.find((thread) => thread.id === threadId);
    if (!existingThread) return;

    const previousValue =
      existingThread.feedbackByMessageId?.[message.id] ?? null;
    const nextValue = resolveFeedbackValue(previousValue, value);

    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id !== threadId
          ? thread
          : {
              ...thread,
              feedbackByMessageId: {
                ...(thread.feedbackByMessageId ?? {}),
                [message.id]: nextValue ?? undefined,
              },
            },
      ),
    );
    setFeedbackPendingByMessageId((current) => ({
      ...current,
      [message.id]: true,
    }));

    try {
      const response = await fetch("/api/chat-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: threadId,
          assistantMessage: message,
          feedback: nextValue,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error("chat feedback update failed", error);
      setThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id !== threadId
            ? thread
            : {
                ...thread,
                feedbackByMessageId: {
                  ...(thread.feedbackByMessageId ?? {}),
                  [message.id]: previousValue ?? undefined,
                },
              },
        ),
      );
    } finally {
      setFeedbackPendingByMessageId((current) => {
        const nextState = { ...current };
        delete nextState[message.id];
        return nextState;
      });
    }
  };

  const handleDeleteThread = (threadId: string) => {
    const previousThreads = threads;
    const previousActiveThreadId = activeThreadId;

    setThreads((currentThreads) => {
      if (currentThreads.length === 1) {
        const nextThread = createThread();
        setActiveThreadId(nextThread.id);
        return [nextThread];
      }

      const remainingThreads = currentThreads.filter(
        (thread) => thread.id !== threadId,
      );

      setActiveThreadId((currentActiveThreadId) => {
        if (currentActiveThreadId !== threadId) {
          return currentActiveThreadId;
        }

        return remainingThreads[0]?.id ?? createThread().id;
      });

      return remainingThreads;
    });
    setSidebarOpen(false);

    void fetch("/api/chat-thread", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: threadId }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
        }
      })
      .catch((error) => {
        console.error("chat thread delete failed", error);
        setThreads(previousThreads);
        setActiveThreadId(previousActiveThreadId);
      });
  };

  const handleNewChat = () => {
    const thread = {
      ...createThread(),
      market: activeThread?.market ?? "CN",
    };
    setThreads((currentThreads) => [thread, ...currentThreads]);
    setActiveThreadId(thread.id);
    setSidebarOpen(false);
  };

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setSidebarOpen(false);
  };

  if (!activeThread) {
    return <div className="h-[100dvh] bg-white" />;
  }

  return (
    <section
      className="flex h-[100dvh] w-full overflow-hidden"
      style={{
        background: CHAT_UI_THEME.appBackground,
        color: CHAT_UI_THEME.textPrimary,
      }}
    >
      <div className="hidden w-[280px] shrink-0 lg:block">
        <Sidebar
          activeThreadId={activeThread.id}
          onDeleteThread={handleDeleteThread}
          onNewChat={handleNewChat}
          onSelectThread={handleSelectThread}
          threads={orderedThreads}
        />
      </div>

      <div
        className={[
          "fixed inset-0 z-40 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden",
          sidebarOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setSidebarOpen(false)}
      >
        <div className="absolute inset-0 bg-black/28 backdrop-blur-[2px]" />
        <div
          className={[
            "relative h-full w-[280px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
          onClick={(event) => event.stopPropagation()}
        >
          <Sidebar
            activeThreadId={activeThread.id}
            onDeleteThread={handleDeleteThread}
            onNewChat={handleNewChat}
            onSelectThread={handleSelectThread}
            threads={orderedThreads}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1">
        <ChatWorkspace
          feedbackPendingByMessageId={feedbackPendingByMessageId}
          key={activeThread.id}
          onFeedbackChange={handleFeedbackChange}
          onThreadMarketChange={(threadId, market) => {
            setThreads((currentThreads) =>
              currentThreads.map((thread) =>
                thread.id !== threadId ? thread : { ...thread, market },
              ),
            );
          }}
          onMessagesChange={handleMessagesChange}
          onOpenSidebar={() => setSidebarOpen(true)}
          thread={activeThread}
        />
      </div>
    </section>
  );
}
