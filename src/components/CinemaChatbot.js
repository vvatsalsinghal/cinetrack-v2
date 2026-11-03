"use client";

/**
 * ==============================================================================
 * CINEMATRACK AI ASSISTANT (FLOATING CLIENT COMPONENT)
 * ==============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * Provides a floating AI cinema concierge available across all pages of the app.
 * - Streams recommendations in real-time from Gemini AI via Next.js Route Handler.
 * - Injects user's "My Cinema" saved watchlist so recommendations match their taste.
 * - Renders streaming markdown (bold titles, lists, headings) with live typing indicator.
 * ==============================================================================
 */

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

let messageCounter = 0;

// Creates a uniquely identified chat message
function createMessage(role, content) {
  messageCounter += 1;
  return {
    id: `${role}-${messageCounter}-${Date.now()}`,
    role,
    content,
  };
}

// Formats **bold** and *italic* text inside a string
function formatInlineText(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|\*[^*\n]+?\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-accent">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={index} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

// Renders formatted message content with headings, bullets, and typing cursor
function MessageContent({ content, isStreaming }) {
  if (!content && isStreaming) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        <span>Curating recommendations…</span>
      </span>
    );
  }

  if (!content) return null;

  const paragraphs = content.split("\n\n");

  return (
    <>
      {paragraphs.map((paragraph, pIdx) => {
        const lines = paragraph.split("\n");

        return (
          <div key={pIdx} className="mb-2.5 last:mb-0 leading-relaxed">
            {lines.map((rawLine, lIdx) => {
              const line = rawLine.trim();
              if (!line) return null;

              // Heading (### Title)
              if (line.startsWith("### ")) {
                return (
                  <h4 key={lIdx} className="mt-2 mb-1 text-[13px] font-semibold text-foreground">
                    {formatInlineText(line.slice(4))}
                  </h4>
                );
              }

              // Bullet points (- or *)
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <div key={lIdx} className="my-0.5 flex items-start gap-1.5 pl-1">
                    <span className="shrink-0 font-bold text-accent">•</span>
                    <span>{formatInlineText(line.slice(2))}</span>
                  </div>
                );
              }

              // Numbered list item (1. Item)
              const numMatch = line.match(/^(\d+)\.\s+(.*)/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="my-0.5 flex items-start gap-1.5 pl-1">
                    <span className="shrink-0 font-semibold text-accent">{numMatch[1]}.</span>
                    <span>{formatInlineText(numMatch[2])}</span>
                  </div>
                );
              }

              return <p key={lIdx} className="my-0.5">{formatInlineText(rawLine)}</p>;
            })}
          </div>
        );
      })}

      {/* Live typing cursor during streaming */}
      {isStreaming && (
        <span
          aria-hidden="true"
          className="ml-1 inline-block h-3.5 w-1.5 rounded-sm bg-accent animate-pulse align-middle"
        />
      )}
    </>
  );
}

export default function CinemaChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadChatHistory());
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeStreamingId, setActiveStreamingId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Read saved movies from context or browser storage to give the AI taste context
  const { accountMovies = [] } = useCineTrack() || {};
  const activeWatchlist = accountMovies.length > 0 ? accountMovies : readSavedMovies();

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // Auto-scroll and focus input when opened or when messages change
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages]);

  /**
   * Sends user message to `/api/chat` and reads the Server-Sent Events (SSE) stream.
   */
  async function handleSendMessage(textToSend) {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading || activeStreamingId) return;

    // 1. Append user message to state and storage
    const userMessage = createMessage("user", text);
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveChatHistory(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      // 2. POST request to Next.js API route
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
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

      // Handle non-streaming JSON errors (e.g. rate limits or server error)
      if (!response.ok || response.headers.get("content-type")?.includes("application/json")) {
        const errData = await response.json().catch(() => ({}));
        const errMessage = createMessage(
          "assistant",
          errData.error || `⚠️ Server error (${response.status})`,
        );
        const nextList = [...updatedMessages, errMessage];
        setMessages(nextList);
        saveChatHistory(nextList);
        return;
      }

      // 3. Read incoming stream chunks
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream reader unavailable");

      const decoder = new TextDecoder();
      const assistantMessage = createMessage("assistant", "");
      let accumulatedText = "";

      setIsLoading(false);
      setActiveStreamingId(assistantMessage.id);
      setMessages((prev) => [...prev, assistantMessage]);
      scrollToBottom();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulatedText += decoder.decode(value, { stream: true });
        const currentText = accumulatedText;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, content: currentText } : msg,
          ),
        );
        scrollToBottom();
      }

      const finalContent =
        accumulatedText.trim() || "⚠️ Could not retrieve recommendations. Please try asking again.";

      const completed = [
        ...updatedMessages,
        { ...assistantMessage, content: finalContent },
      ];
      setMessages(completed);
      saveChatHistory(completed);
    } catch {
      const errMessage = createMessage(
        "assistant",
        "⚠️ Could not connect to CineTrack AI. Please check your internet connection.",
      );
      const nextList = [...updatedMessages, errMessage];
      setMessages(nextList);
      saveChatHistory(nextList);
    } finally {
      setIsLoading(false);
      setActiveStreamingId(null);
    }
  }

  function handleResetChat() {
    clearChatHistory();
    setMessages([DEFAULT_INITIAL_MESSAGE]);
  }

  return (
    <>
      {/* Floating Sparkle Button to Open Chat */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open CineTrack AI Concierge"
            className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-surface/90 text-accent shadow-[0_0_25px_rgba(56,189,248,0.3)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-accent hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <span className="absolute -inset-0.5 rounded-full bg-accent/20 blur-sm animate-pulse" />
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
          <div className="flex items-center justify-between border-b border-line bg-background/50 px-4 py-3.5">
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
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
                  className={`mb-3.5 flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                      isUser
                        ? "bg-accent font-medium text-ink"
                        : "border border-line bg-surface/90 text-foreground"
                    }`}
                  >
                    <MessageContent content={msg.content} isStreaming={isStreamingThis} />
                  </div>
                </div>
              );
            })}

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

          {/* Suggested Starter Prompts */}
          {messages.length <= 2 && (
            <div className="flex gap-1.5 overflow-x-auto border-t border-line/50 px-4 py-2 scrollbar-none">
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
            className="flex items-center gap-2 border-t border-line bg-background/60 p-3"
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>

          {/* Taste Context Indicator */}
          <div className="border-t border-line/40 bg-background/40 px-3 py-1.5 text-center text-[10px] text-muted/70">
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
