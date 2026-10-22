const STORAGE_KEY = "cinetrack.my-cinema.v1";
const MOVIE_STATUSES = ["saved", "watching", "finished"];
const TMDB_POSTER_URL =
  /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;
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

function isSavedMovie(movie) {
  return (
    typeof movie === "object" &&
    movie !== null &&
    Number.isInteger(movie.id) &&
    movie.id > 0 &&
    typeof movie.title === "string" &&
    movie.title.trim().length > 0 &&
    movie.title.length <= 200 &&
    (movie.posterUrl === null ||
      (typeof movie.posterUrl === "string" &&
        TMDB_POSTER_URL.test(movie.posterUrl))) &&
    (movie.releaseYear === null ||
      (typeof movie.releaseYear === "string" &&
        /^\d{4}$/.test(movie.releaseYear))) &&
    (movie.rating === null ||
      (Number.isInteger(movie.rating) &&
        movie.rating >= 1 &&
        movie.rating <= 5)) &&
    typeof movie.review === "string" &&
    movie.review.length <= 500 &&
    MOVIE_STATUSES.includes(movie.status)
  );
}

function readStorageValue() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    if (error instanceof DOMException) {
      throw new MyCinemaStorageError(
        "Browser storage is unavailable. Check your browser privacy settings.",
      );
    }

    throw error;
  }
}

export function readSavedMovies() {
  const storedValue = readStorageValue();

  if (storedValue === null) {
    return [];
  }

  let movies;

  try {
    movies = JSON.parse(storedValue);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new MyCinemaStorageError(
        "Your saved collection data could not be read. It has not been changed.",
      );
    }

    throw error;
  }

  if (!Array.isArray(movies)) {
    throw new MyCinemaStorageError(
      "Your saved collection has an unsupported format. It has not been changed.",
    );
  }

  const normalizedMovies = movies.map((movie) => ({
    ...movie,
    rating: movie?.rating ?? null,
    review: movie?.review ?? "",
  }));

  if (!normalizedMovies.every(isSavedMovie)) {
    throw new MyCinemaStorageError(
      "Your saved collection has an unsupported format. It has not been changed.",
    );
  }

  return normalizedMovies;
}

function writeSavedMovies(movies) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
  } catch (error) {
    if (error instanceof DOMException) {
      throw new MyCinemaStorageError(
        "Your movie could not be saved. Browser storage may be unavailable or full.",
      );
    }

    throw error;
  }
}

export function clearSavedMovies() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    if (error instanceof DOMException) {
      throw new MyCinemaStorageError(
        "Your local movies were copied to your account, but browser storage could not be cleared.",
      );
    }

    throw error;
  }

  publishSnapshot({ status: "ready", movies: [], error: "" });
}

function publishSnapshot(nextSnapshot) {
  snapshot = Object.freeze(nextSnapshot);
  listeners.forEach((listener) => listener());
}

function refreshSnapshot() {
  try {
    publishSnapshot({
      status: "ready",
      movies: readSavedMovies(),
      error: "",
    });
  } catch (error) {
    if (!(error instanceof MyCinemaStorageError)) {
      throw error;
    }

    publishSnapshot({
      status: "error",
      movies: [],
      error: error.message,
    });
  }
}

function handleStorageChange(event) {
  if (event.key === STORAGE_KEY || event.key === null) {
    refreshSnapshot();
  }
}

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

export function saveMovieForLater(movie) {
  const savedMovies = readSavedMovies();

  if (savedMovies.some((savedMovie) => savedMovie.id === movie.id)) {
    publishSnapshot({ status: "ready", movies: savedMovies, error: "" });
    return savedMovies;
  }

  const savedMovie = {
    id: movie.id,
    title: movie.title,
    posterUrl: movie.posterUrl,
    releaseYear: movie.releaseYear,
    rating: null,
    review: "",
    status: "saved",
  };

  if (!isSavedMovie(savedMovie)) {
    throw new MyCinemaStorageError(
      "This movie does not have the information needed to save it.",
    );
  }

  const updatedMovies = [savedMovie, ...savedMovies];
  writeSavedMovies(updatedMovies);
  publishSnapshot({ status: "ready", movies: updatedMovies, error: "" });
  return updatedMovies;
}

export function removeSavedMovie(movieId) {
  const updatedMovies = readSavedMovies().filter(
    (movie) => movie.id !== movieId,
  );
  writeSavedMovies(updatedMovies);
  publishSnapshot({ status: "ready", movies: updatedMovies, error: "" });
  return updatedMovies;
}

export function updateMovieStatus(movieId, status) {
  if (!Number.isInteger(movieId) || movieId < 1) {
    throw new MyCinemaStorageError("This movie could not be updated.");
  }

  if (!MOVIE_STATUSES.includes(status)) {
    throw new MyCinemaStorageError("Choose a valid My Cinema status.");
  }

  const savedMovies = readSavedMovies();
  const movieExists = savedMovies.some((movie) => movie.id === movieId);

  if (!movieExists) {
    throw new MyCinemaStorageError(
      "This movie is no longer in My Cinema. Reload the page and try again.",
    );
  }

  const updatedMovies = savedMovies.map((movie) =>
    movie.id === movieId ? { ...movie, status } : movie,
  );
  writeSavedMovies(updatedMovies);
  publishSnapshot({ status: "ready", movies: updatedMovies, error: "" });
  return updatedMovies;
}

export function updateMovieNotes(movieId, rating, review) {
  if (
    !Number.isInteger(movieId) ||
    movieId < 1 ||
    (rating !== null &&
      (!Number.isInteger(rating) || rating < 1 || rating > 5)) ||
    typeof review !== "string" ||
    review.trim().length > 500
  ) {
    throw new MyCinemaStorageError(
      "Choose a rating from 1 to 5 and keep your note within 500 characters.",
    );
  }

  const savedMovies = readSavedMovies();
  const movieExists = savedMovies.some((movie) => movie.id === movieId);

  if (!movieExists) {
    throw new MyCinemaStorageError(
      "This movie is no longer in My Cinema. Reload the page and try again.",
    );
  }

  const updatedMovies = savedMovies.map((movie) =>
    movie.id === movieId
      ? { ...movie, rating, review: review.trim() }
      : movie,
  );
  writeSavedMovies(updatedMovies);
  publishSnapshot({ status: "ready", movies: updatedMovies, error: "" });
  return updatedMovies;
}
