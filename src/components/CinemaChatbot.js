"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  clearChatHistory,
  DEFAULT_INITIAL_MESSAGE,
  loadChatHistory,
  saveChatHistory,
} from "@/lib/chatMemory";
import { readSavedMovies } from "@/lib/myCinema";
import { useCineTrack } from "@/components/CineTrackProvider";

const SUGGESTED_PROMPTS = [
  "🇮🇳 Top Indian cinema masterworks & hidden gems",
  "🍿 Best feel-good Bollywood or South cinema pick",
  "🔥 High-octane Indian thriller like RRR or Vikram",
  "🎯 Recommend a film based on my taste",
];

let messageIdSequence = 0;

function createChatMessage(role, content) {
  messageIdSequence += 1;
  return {
    id: `${role}-${messageIdSequence}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
  };
}

function getInitialLocalMovies() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    return readSavedMovies();
  } catch {
    return [];
  }
}

export default function CinemaChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadChatHistory());
  const [localMovies] = useState(() => getInitialLocalMovies());
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeStreamingId, setActiveStreamingId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamAccumulatorRef = useRef("");

  // Read personal cinema memory from either authenticated account or local storage
  const { accountMovies = [] } = useCineTrack() || {};

  // Sync watchlist: prioritize account movies, fallback to local storage
  const activeWatchlist =
    accountMovies.length > 0 ? accountMovies : localMovies;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages]);

  async function handleSendMessage(textToSend) {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading || activeStreamingId) return;

    const userMessage = createChatMessage("user", text);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    saveChatHistory(nextMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          userContext: {
            watchlist: activeWatchlist.map((m) => ({
              title: m.title,
              status: m.status,
              rating: m.rating,
              review: m.review,
            })),
          },
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      // If server returned an error JSON payload
      if (!response.ok || contentType.includes("application/json")) {
        const errData = await response.json().catch(() => ({}));
        const errMessage = createChatMessage(
          "assistant",
          errData.error || errData.reply || `⚠️ Server error (${response.status})`,
        );
        const updated = [...nextMessages, errMessage];
        setMessages(updated);
        saveChatHistory(updated);
        setIsLoading(false);
        return;
      }

      // Real-Time Word-by-Word Streaming
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream reader not available");
      }

      const decoder = new TextDecoder();
      const assistantMessage = createChatMessage("assistant", "");
      streamAccumulatorRef.current = "";

      // Immediately activate streaming state and insert assistant bubble with live indicator
      setIsLoading(false);
      setActiveStreamingId(assistantMessage.id);
      setMessages((prev) => [...prev, assistantMessage]);
      scrollToBottom();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamAccumulatorRef.current += chunk;
        const currentText = streamAccumulatorRef.current;

        // Update text in real time as tokens arrive
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: currentText }
              : m,
          ),
        );
        scrollToBottom();
      }

      // Persist the full completed message to localStorage
      saveChatHistory([
        ...nextMessages,
        { ...assistantMessage, content: streamAccumulatorRef.current },
      ]);
    } catch {
      const errorMessage = createChatMessage(
        "assistant",
        "⚠️ Could not connect to CineTrack AI. Please check your internet connection or server logs.",
      );
      const updated = [...nextMessages, errorMessage];
      setMessages(updated);
      saveChatHistory(updated);
    } finally {
      setIsLoading(false);
      setActiveStreamingId(null);
    }
  }

  function handleResetChat() {
    clearChatHistory();
    setMessages([DEFAULT_INITIAL_MESSAGE]);
  }

  // Format message text: converts **bold** to highlighted text, markdown bullet points, and live cursor
  function renderFormattedContent(content, isStreamingThisMessage) {
    if (!content && isStreamingThisMessage) {
      return (
        <span className="inline-flex items-center gap-1.5 text-muted text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span>Writing recommendation…</span>
        </span>
      );
    }

    if (!content) return null;

    const paragraphs = content.split("\n\n");

    return (
      <>
        {paragraphs.map((para, pIdx) => {
          const lines = para.split("\n");

          return (
            <p key={pIdx} className="mb-2.5 last:mb-0 leading-relaxed">
              {lines.map((line, lIdx) => {
                const parts = line.split(/(\*\*.*?\*\*)/g);

                return (
                  <span key={lIdx} className="block">
                    {parts.map((part, partIdx) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        const cleanText = part.slice(2, -2);
                        return (
                          <strong
                            key={partIdx}
                            className="font-semibold text-accent"
                          >
                            {cleanText}
                          </strong>
                        );
                      }

                      if (part.startsWith("- ") || part.startsWith("* ")) {
                        return (
                          <span key={partIdx} className="inline-block pl-2">
                            • {part.slice(2)}
                          </span>
                        );
                      }

                      return part;
                    })}
                  </span>
                );
              })}
            </p>
          );
        })}

        {/* Live Blinking Typing Cursor */}
        {isStreamingThisMessage && (
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-1.5 rounded-sm bg-accent animate-pulse ml-1 align-middle"
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open CineTrack AI Concierge"
            className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-surface/90 text-accent shadow-[0_0_25px_rgba(56,189,248,0.3)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-accent hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {/* Pulsing Aura */}
            <span className="absolute -inset-0.5 rounded-full bg-accent/20 blur-sm animate-pulse" />

            {/* AI Sparkle Projector Icon */}
            <svg
              className="relative h-6 w-6 transition-transform group-hover:rotate-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>

            {/* Tooltip hint on hover */}
            <span className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-surface/95 px-3 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100">
              CineTrack AI
            </span>
          </button>
        )}
      </div>

      {/* Floating Chat Window */}
      {isOpen && (
        <aside
          aria-label="CineTrack AI Concierge Chat"
          className="fixed bottom-4 right-4 z-50 flex h-[580px] max-h-[85vh] w-[92vw] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5 bg-background/50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                ✨
              </span>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  CineTrack AI
                </h3>
                <p className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  {activeStreamingId
                    ? "Live typing…"
                    : activeWatchlist.length > 0
                      ? `Memory active (${activeWatchlist.length} films)`
                      : "Ready to assist"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="Reset conversation"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 text-xs">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const isStreamingThis = msg.id === activeStreamingId;

              return (
                <div
                  key={msg.id}
                  className={`mb-3.5 flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                      isUser
                        ? "bg-accent text-ink font-medium"
                        : "border border-line bg-surface/90 text-foreground"
                    }`}
                  >
                    {renderFormattedContent(msg.content, isStreamingThis)}
                  </div>
                </div>
              );
            })}

            {/* AI Typing Indicator (only shows for the brief ~300ms before tokens arrive) */}
            {isLoading && (
              <div className="mb-3.5 flex items-start">
                <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface/90 px-4 py-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggested Prompt Chips */}
          {messages.length <= 2 && (
            <div className="flex gap-1.5 overflow-x-auto px-4 py-2 border-t border-line/50 scrollbar-none">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="shrink-0 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="border-t border-line p-3 bg-background/60 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask for recommendations, directors, trivia…"
              disabled={isLoading || Boolean(activeStreamingId)}
              className="min-h-10 flex-1 rounded-xl border border-line bg-surface px-3.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading || Boolean(activeStreamingId)}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-ink font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </form>

          {/* Watchlist Context Footnote */}
          <div className="border-t border-line/40 px-3 py-1.5 text-center text-[10px] text-muted/70 bg-background/40">
            {activeWatchlist.length > 0 ? (
              <span>
                Personalized using your{" "}
                <Link href="/my-cinema" className="underline hover:text-accent">
                  My Cinema
                </Link>{" "}
                taste
              </span>
            ) : (
              <span>Save films to My Cinema for tailored recommendations</span>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
