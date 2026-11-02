/**
 * ==============================================================================
 * MY CINEMA STORAGE MODULE (OFFLINE-FIRST STORE)
 * ==============================================================================
 * Concept:
 * When users visit CineTrack without signing in, their saved movies, ratings,
 * and notes are saved in the browser's `localStorage`.
 *
 * Why useSyncExternalStore?
 * In Next.js (Server-Side Rendering), `window.localStorage` does NOT exist on the server.
 * If a React component directly reads localStorage on the server, Next.js throws
 * a "Hydration Mismatch" error.
 * React provides `useSyncExternalStore` to safely bridge external stores (like localStorage)
 * with React components, ensuring smooth hydration and instant UI updates.
 * ==============================================================================
 */

// The key name used in browser's localStorage
const STORAGE_KEY = "cinetrack.my-cinema.v1";

// Allowed watch statuses for any movie
const MOVIE_STATUSES = ["saved", "watching", "finished"];

// Default server snapshot used during initial Server-Side Rendering (SSR)
// Object.freeze ensures nobody can accidentally mutate this initial snapshot object
const SERVER_SNAPSHOT = Object.freeze({
  status: "loading",
  movies: [],
  error: "",
});

// A Set of callback listener functions registered by active React components
const listeners = new Set();
let snapshot = SERVER_SNAPSHOT;

// Custom Error class to distinguish localStorage errors from generic network errors
export class MyCinemaStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "MyCinemaStorageError";
  }
}

/**
 * Validates whether an incoming object has the required fields of a CineTrack movie.
 * Prevents corrupted data from entering the user's library.
 */
function isValidMovie(movie) {
  return Boolean(
    movie &&
    typeof movie === "object" &&
    movie.id &&
    movie.title &&
    MOVIE_STATUSES.includes(movie.status || "saved"),
  );
}

/**
 * Broadcasts the updated movie list to all subscribed React components.
 * When React components hear the notification, they re-render with the latest movies.
 */
function publishSnapshot(nextSnapshot) {
  snapshot = Object.freeze(nextSnapshot);
  listeners.forEach((listener) => listener());
}

/**
 * Reads movies from `localStorage`.
 * Always guarded with `typeof window !== "undefined"` because this file can run on Node.js server.
 */
export function readSavedMovies() {
  // If running on server (SSR), return empty array because window is undefined
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out invalid items and normalize default properties
    return parsed
      .filter(isValidMovie)
      .map((movie) => ({
        ...movie,
        status: movie.status || "saved",
        rating: movie.rating ?? null,
        review: movie.review || "",
      }));
  } catch {
    // If JSON is corrupted or storage is inaccessible, gracefully return empty array
    return [];
  }
}

/**
 * Helper to write movies array to `localStorage` and trigger React re-renders.
 */
function saveAndPublish(movies) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
  } catch {
    throw new MyCinemaStorageError(
      "Your movie could not be saved. Browser storage may be full or disabled.",
    );
  }

  // Notify all UI components that the data changed
  publishSnapshot({ status: "ready", movies, error: "" });
  return movies;
}

/**
 * Clears all movies from local browser storage.
 * Called automatically when user signs in and their local movies migrate to MongoDB.
 */
export function clearSavedMovies() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw new MyCinemaStorageError("Could not clear browser storage.");
  }

  publishSnapshot({ status: "ready", movies: [], error: "" });
}

/**
 * Refreshes snapshot with the latest items currently in localStorage.
 */
function refreshSnapshot() {
  publishSnapshot({
    status: "ready",
    movies: readSavedMovies(),
    error: "",
  });
}

/**
 * Multi-tab synchronization:
 * If the user has CineTrack open in two tabs and adds a movie in Tab A,
 * the browser fires a "storage" event in Tab B. This listener catches it and updates Tab B!
 */
function handleStorageChange(event) {
  if (event.key === STORAGE_KEY || event.key === null) {
    refreshSnapshot();
  }
}

/**
 * Subscribes a React component to localStorage changes.
 * Used by React's `useSyncExternalStore(subscribeToMyCinema, getMyCinemaSnapshot, getMyCinemaServerSnapshot)`
 */
export function subscribeToMyCinema(listener) {
  listeners.add(listener);

  if (snapshot === SERVER_SNAPSHOT) {
    refreshSnapshot();
  }

  // Listen for storage changes from other browser tabs
  window.addEventListener("storage", handleStorageChange);

  // Return unsubscribe cleanup function
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
  };
}

// Client snapshot getter
export function getMyCinemaSnapshot() {
  return snapshot;
}

// Server snapshot getter (used during SSR)
export function getMyCinemaServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/**
 * Adds a new movie to the user's watchlist ("Saved for later").
 * Prepends the new movie to the front of the array so newly saved movies appear first.
 */
export function saveMovieForLater(movie) {
  if (!movie || !movie.id) {
    throw new MyCinemaStorageError("Movie information is missing.");
  }

  const currentMovies = readSavedMovies();

  // Guard against duplicate saves: if already in list, do not add again
  if (currentMovies.some((m) => m.id === movie.id)) {
    publishSnapshot({ status: "ready", movies: currentMovies, error: "" });
    return currentMovies;
  }

  const newMovie = {
    id: movie.id,
    title: movie.title,
    posterUrl: movie.posterUrl || null,
    releaseYear: movie.releaseYear || null,
    rating: null,
    review: "",
    status: "saved",
  };

  // Prepend to top of array
  return saveAndPublish([newMovie, ...currentMovies]);
}

/**
 * Deletes a movie from the user's local library by its unique ID.
 */
export function removeSavedMovie(movieId) {
  const currentMovies = readSavedMovies();
  const updatedMovies = currentMovies.filter((movie) => movie.id !== movieId);
  return saveAndPublish(updatedMovies);
}

/**
 * Updates a movie's status between "saved" (watchlist), "watching", and "finished".
 */
export function updateMovieStatus(movieId, status) {
  if (!MOVIE_STATUSES.includes(status)) {
    throw new MyCinemaStorageError("Choose a valid movie status.");
  }

  const currentMovies = readSavedMovies();
  const updatedMovies = currentMovies.map((movie) =>
    movie.id === movieId ? { ...movie, status } : movie,
  );

  return saveAndPublish(updatedMovies);
}

/**
 * Updates user's personal 1-5 star rating and private review note.
 */
export function updateMovieNotes(movieId, rating, review) {
  const currentMovies = readSavedMovies();
  const cleanReview = typeof review === "string" ? review.trim() : "";

  const updatedMovies = currentMovies.map((movie) =>
    movie.id === movieId
      ? { ...movie, rating, review: cleanReview }
      : movie,
  );

  return saveAndPublish(updatedMovies);
}
