const CHAT_STORAGE_KEY = "cinetrack.ai-chat.v1";
const MAX_SAVED_MESSAGES = 50;

export const DEFAULT_INITIAL_MESSAGE = {
  id: "welcome-message",
  role: "assistant",
  content:
    "Hey! I'm **CineTrack AI**, your cinema concierge. 🎬\n\nI remember what you save and rate in **My Cinema**, so you never have to repeat your taste. What are you in the mood for tonight?",
  timestamp: Date.now(),
};

export function loadChatHistory() {
  if (typeof window === "undefined") {
    return [DEFAULT_INITIAL_MESSAGE];
  }

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      return [DEFAULT_INITIAL_MESSAGE];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [DEFAULT_INITIAL_MESSAGE];
    }

    return parsed;
  } catch {
    return [DEFAULT_INITIAL_MESSAGE];
  }
}

export function saveChatHistory(messages) {
  if (typeof window === "undefined" || !Array.isArray(messages)) {
    return;
  }

  try {
    const trimmed = messages.slice(-MAX_SAVED_MESSAGES);
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota or security errors gracefully
  }
}

export function clearChatHistory() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Ignore error
  }
}

