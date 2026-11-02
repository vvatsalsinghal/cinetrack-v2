const STORAGE_KEY = "cinetrack.my-cinema.v1";
const MOVIE_STATUSES = ["saved", "watching", "finished"];

const SERVER_SNAPSHOT = Object.freeze({
  status: "loading",
  movies: [],
  error: "",
});

const listeners = new Set();
let snapshot = SERVER_SNAPSHOT;

export class MyCinemaStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "MyCinemaStorageError";
  }
}

// Simple check to ensure a movie has the basic required data
function isValidMovie(movie) {
  return Boolean(
    movie &&
    typeof movie === "object" &&
    movie.id &&
    movie.title &&
    MOVIE_STATUSES.includes(movie.status || "saved"),
  );
}

// Publish state updates to React components subscribed via useSyncExternalStore
function publishSnapshot(nextSnapshot) {
  snapshot = Object.freeze(nextSnapshot);
  listeners.forEach((listener) => listener());
}

// Safely read saved movies from browser localStorage
export function readSavedMovies() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Return only valid movies, ensuring default rating and review
    return parsed
      .filter(isValidMovie)
      .map((movie) => ({
        ...movie,
        status: movie.status || "saved",
        rating: movie.rating ?? null,
        review: movie.review || "",
      }));
  } catch {
    return [];
  }
}

// Save movies to localStorage and notify all UI listeners
function saveAndPublish(movies) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
  } catch {
    throw new MyCinemaStorageError(
      "Your movie could not be saved. Browser storage may be full or disabled.",
    );
  }

  publishSnapshot({ status: "ready", movies, error: "" });
  return movies;
}

// Remove all saved movies from localStorage
export function clearSavedMovies() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw new MyCinemaStorageError("Could not clear browser storage.");
  }

  publishSnapshot({ status: "ready", movies: [], error: "" });
}

function refreshSnapshot() {
  publishSnapshot({
    status: "ready",
    movies: readSavedMovies(),
    error: "",
  });
}

function handleStorageChange(event) {
  if (event.key === STORAGE_KEY || event.key === null) {
    refreshSnapshot();
  }
}

// Connects React components (useSyncExternalStore) to localStorage changes
export function subscribeToMyCinema(listener) {
  listeners.add(listener);

  if (snapshot === SERVER_SNAPSHOT) {
    refreshSnapshot();
  }

  window.addEventListener("storage", handleStorageChange);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
  };
}

export function getMyCinemaSnapshot() {
  return snapshot;
}

export function getMyCinemaServerSnapshot() {
  return SERVER_SNAPSHOT;
}

// Add a movie to the "Saved for later" list
export function saveMovieForLater(movie) {
  if (!movie || !movie.id) {
    throw new MyCinemaStorageError("Movie information is missing.");
  }

  const currentMovies = readSavedMovies();

  // If already saved, don't add duplicates
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

  return saveAndPublish([newMovie, ...currentMovies]);
}

// Remove a movie from the saved list by its ID
export function removeSavedMovie(movieId) {
  const currentMovies = readSavedMovies();
  const updatedMovies = currentMovies.filter((movie) => movie.id !== movieId);
  return saveAndPublish(updatedMovies);
}

// Update the status of a movie ("saved", "watching", or "finished")
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

// Update the user's star rating (1-5) and personal note for a movie
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
