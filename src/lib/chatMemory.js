// Storage key and limit for the AI chatbot conversation history
const CHAT_STORAGE_KEY = "cinetrack.ai-chat.v1";
const MAX_SAVED_MESSAGES = 50;

// The default greeting shown when you open the AI concierge for the first time
export const DEFAULT_INITIAL_MESSAGE = {
  id: "welcome-message",
  role: "assistant",
  content:
    "Hey! I'm **CineTrack AI**, your cinema concierge. 🎬\n\nI remember what you save and rate in **My Cinema**, so you never have to repeat your taste. What are you in the mood for tonight?",
  timestamp: Date.now(),
};

// Loads saved chat messages from browser memory (returns default greeting if empty)
export function loadChatHistory() {
  if (typeof window === "undefined") {
    return [DEFAULT_INITIAL_MESSAGE];
  }

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [DEFAULT_INITIAL_MESSAGE];
  } catch {
    return [DEFAULT_INITIAL_MESSAGE];
  }
}

// Saves messages to browser memory, keeping only the most recent 50 messages to save space
export function saveChatHistory(messages) {
  if (typeof window === "undefined" || !Array.isArray(messages)) return;

  try {
    const recentMessages = messages.slice(-MAX_SAVED_MESSAGES);
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(recentMessages));
  } catch {
    // Gracefully ignore storage full or privacy errors
  }
}

// Clears the chat history (triggered when you click the reset/refresh button in the chat)
export function clearChatHistory() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Ignore error
  }
}
