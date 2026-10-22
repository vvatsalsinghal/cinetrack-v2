"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearSavedMovies,
  readSavedMovies,
} from "@/lib/myCinema";

const DEFAULT_API_URL = "http://localhost:4000";
const TMDB_POSTER_URL =
  /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;
const CineTrackContext = createContext(null);

class CineTrackApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CineTrackApiError";
    this.status = status;
  }
}

function getApiUrl() {
  const value =
    process.env.NEXT_PUBLIC_CINETRACK_API_URL?.trim() || DEFAULT_API_URL;
  let url;

  try {
    url = new URL(value);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("The Express API URL is not valid.");
    }

    throw error;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The Express API URL must use HTTP or HTTPS.");
  }

  return url.origin;
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Could not connect to the CineTrack API. Check that it is running and try again.",
      );
    }

    throw error;
  }

  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("The CineTrack API returned an unreadable response.");
      }

      throw error;
    }
  }

  if (!response.ok) {
    throw new CineTrackApiError(
      typeof payload?.error === "string"
        ? payload.error
        : `The CineTrack API returned HTTP ${response.status}.`,
      response.status,
    );
  }

  return payload;
}

function isAccountUser(user) {
  return (
    typeof user === "object" &&
    user !== null &&
    typeof user.id === "string" &&
    typeof user.email === "string"
  );
}

function isAccountMovie(movie) {
  return (
    typeof movie === "object" &&
    movie !== null &&
    Number.isInteger(movie.id) &&
    movie.id > 0 &&
    typeof movie.title === "string" &&
    typeof movie.status === "string" &&
    (movie.posterUrl === null || typeof movie.posterUrl === "string") &&
    (movie.releaseYear === null || typeof movie.releaseYear === "string") &&
    (movie.rating === null || Number.isInteger(movie.rating)) &&
    typeof movie.review === "string"
  );
}

function parseAccountMovies(payload) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray(payload.movies) ||
    !payload.movies.every(isAccountMovie)
  ) {
    throw new Error("The CineTrack API returned an invalid My Cinema collection.");
  }

  return payload.movies;
}

function parseRecommendations(payload) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Number.isInteger(payload.activityCount) ||
    payload.activityCount < 0 ||
    !Array.isArray(payload.basedOn) ||
    !payload.basedOn.every(
      (genre) =>
        typeof genre === "object" &&
        genre !== null &&
        Number.isInteger(genre.id) &&
        genre.id > 0 &&
        typeof genre.name === "string" &&
        genre.name.trim().length > 0,
    ) ||
    !Array.isArray(payload.movies) ||
    !payload.movies.every(
      (movie) =>
        typeof movie === "object" &&
        movie !== null &&
        Number.isInteger(movie.tmdbId) &&
        movie.tmdbId > 0 &&
        typeof movie.title === "string" &&
        movie.title.trim().length > 0 &&
        (movie.releaseYear === null ||
          (typeof movie.releaseYear === "string" &&
            /^\d{4}$/.test(movie.releaseYear))) &&
        (movie.posterUrl === null ||
          (typeof movie.posterUrl === "string" &&
            TMDB_POSTER_URL.test(movie.posterUrl))),
    )
  ) {
    throw new Error("The CineTrack API returned invalid recommendations.");
  }

  return payload;
}

export function CineTrackProvider({ children }) {
  const authVersion = useRef(0);
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking");
  const [accountMovies, setAccountMovies] = useState([]);
  const [cinemaStatus, setCinemaStatus] = useState("loading");
  const [cinemaError, setCinemaError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationGenres, setRecommendationGenres] = useState([]);
  const [recommendationActivityCount, setRecommendationActivityCount] =
    useState(0);
  const [recommendationStatus, setRecommendationStatus] = useState("idle");
  const [recommendationError, setRecommendationError] = useState("");

  const loadAccountCollection = useCallback(async () => {
    const expectedVersion = authVersion.current;
    setCinemaStatus("loading");
    setCinemaError("");

    try {
      const collection = parseAccountMovies(
        await apiRequest("/api/me/cinema"),
      );
      if (expectedVersion !== authVersion.current) {
        return;
      }

      let localMovies = [];
      try {
        localMovies = readSavedMovies();
      } catch (error) {
        setAccountMovies(collection);
        setCinemaStatus("ready");
        setCinemaError(
          error instanceof Error
            ? `${error.message} Sign out only after recovering these local records.`
            : "Local My Cinema records could not be checked for import.",
        );
        return;
      }

      if (localMovies.length === 0) {
        setAccountMovies(collection);
        setCinemaStatus("ready");
        return;
      }

      const imported = parseAccountMovies(
        await apiRequest("/api/me/cinema/import", {
          method: "POST",
          body: JSON.stringify({ movies: localMovies }),
        }),
      );
      if (expectedVersion !== authVersion.current) {
        return;
      }

      clearSavedMovies();
      setAccountMovies(imported);
      setCinemaStatus("ready");
      setCinemaError("");
    } catch (error) {
      if (expectedVersion === authVersion.current) {
        setCinemaStatus("error");
        setCinemaError(
          error instanceof Error
            ? error.message
            : "My Cinema could not be loaded from your account.",
        );
      }
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    const expectedVersion = authVersion.current;
    setRecommendationStatus("loading");
    setRecommendationError("");

    try {
      const result = parseRecommendations(
        await apiRequest("/api/me/recommendations", { cache: "no-store" }),
      );
      if (expectedVersion !== authVersion.current) {
        return;
      }

      setRecommendations(result.movies);
      setRecommendationGenres(result.basedOn);
      setRecommendationActivityCount(result.activityCount);
      setRecommendationStatus("ready");
    } catch (error) {
      if (expectedVersion !== authVersion.current) {
        return;
      }

      setRecommendationStatus("error");
      setRecommendationError(
        error instanceof Error
          ? error.message
          : "Personalized recommendations could not be loaded.",
      );
    }
  }, []);

  const activateAccount = useCallback(
    async (nextUser, expectedVersion) => {
      if (!isAccountUser(nextUser)) {
        throw new Error("The CineTrack API returned an invalid account.");
      }
      if (expectedVersion !== authVersion.current) {
        return;
      }

      setUser(nextUser);
      setAuthStatus("authenticated");
      await loadAccountCollection();
      await loadRecommendations();
    },
    [loadAccountCollection, loadRecommendations],
  );

  useEffect(() => {
    let cancelled = false;
    const expectedVersion = authVersion.current;

    async function loadCurrentAccount() {
      try {
        const payload = await apiRequest("/api/auth/me");
        if (!isAccountUser(payload?.user)) {
          throw new Error("The CineTrack API returned an invalid account.");
        }

        if (!cancelled && expectedVersion === authVersion.current) {
          await activateAccount(payload.user, expectedVersion);
        }
      } catch (error) {
        if (cancelled || expectedVersion !== authVersion.current) {
          return;
        }

        if (error instanceof CineTrackApiError && error.status === 401) {
          setUser(null);
          setAuthStatus("anonymous");
          setCinemaStatus("ready");
          return;
        }

        setAuthStatus("error");
        setCinemaStatus("ready");
        setCinemaError(
          error instanceof Error
            ? error.message
            : "Your account session could not be checked.",
        );
      }
    }

    loadCurrentAccount();
    return () => {
      cancelled = true;
    };
  }, [activateAccount]);

  const register = useCallback(
    async ({ email, password }) => {
      const payload = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const expectedVersion = ++authVersion.current;
      await activateAccount(payload?.user, expectedVersion);
    },
    [activateAccount],
  );

  const login = useCallback(
    async ({ email, password }) => {
      const payload = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const expectedVersion = ++authVersion.current;
      await activateAccount(payload?.user, expectedVersion);
    },
    [activateAccount],
  );

  const logout = useCallback(async () => {
    await apiRequest("/api/auth/logout", { method: "POST" });
    authVersion.current += 1;
    setUser(null);
    setAccountMovies([]);
    setAuthStatus("anonymous");
    setCinemaStatus("ready");
    setCinemaError("");
    setRecommendations([]);
    setRecommendationGenres([]);
    setRecommendationActivityCount(0);
    setRecommendationStatus("idle");
    setRecommendationError("");
  }, []);

  const updateProfile = useCallback(async (profileData) => {
    const payload = await apiRequest("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(profileData),
    });
    if (isAccountUser(payload?.user)) {
      setUser(payload.user);
    }
    return payload?.user;
  }, []);

  const saveAccountMovie = useCallback(async (movie) => {
    const expectedVersion = authVersion.current;
    const payload = await apiRequest("/api/me/cinema", {
      method: "POST",
      body: JSON.stringify(movie),
    });
    if (!isAccountMovie(payload?.movie)) {
      throw new Error("The CineTrack API returned an invalid saved movie.");
    }

    if (expectedVersion === authVersion.current) {
      setAccountMovies((currentMovies) => [
        payload.movie,
        ...currentMovies.filter((item) => item.id !== payload.movie.id),
      ]);
      loadRecommendations();
    }
  }, [loadRecommendations]);

  const updateAccountMovie = useCallback(async (movieId, changes) => {
    const expectedVersion = authVersion.current;
    const payload = await apiRequest(`/api/me/cinema/${movieId}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    if (!isAccountMovie(payload?.movie)) {
      throw new Error("The CineTrack API returned an invalid movie update.");
    }

    if (expectedVersion === authVersion.current) {
      setAccountMovies((currentMovies) =>
        currentMovies.map((movie) =>
          movie.id === movieId ? payload.movie : movie,
        ),
      );
      loadRecommendations();
    }
  }, [loadRecommendations]);

  const removeAccountMovie = useCallback(async (movieId) => {
    const expectedVersion = authVersion.current;
    await apiRequest(`/api/me/cinema/${movieId}`, { method: "DELETE" });
    if (expectedVersion === authVersion.current) {
      setAccountMovies((currentMovies) =>
        currentMovies.filter((movie) => movie.id !== movieId),
      );
      loadRecommendations();
    }
  }, [loadRecommendations]);

  const getFriends = useCallback(async () => {
    return await apiRequest("/api/friends");
  }, []);

  const sendFriendRequest = useCallback(async (handle) => {
    return await apiRequest("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ handle }),
    });
  }, []);

  const acceptFriendRequest = useCallback(async (id) => {
    return await apiRequest(`/api/friends/${id}/accept`, {
      method: "POST",
    });
  }, []);

  const removeFriend = useCallback(async (id) => {
    return await apiRequest(`/api/friends/${id}`, {
      method: "DELETE",
    });
  }, []);

  const getMovieNightMatch = useCallback(async (friendHandle) => {
    return await apiRequest(`/api/me/match/${encodeURIComponent(friendHandle)}`);
  }, []);

  const value = useMemo(
    () => ({
      user,
      authStatus,
      accountMovies,
      cinemaStatus,
      cinemaError,
      recommendations,
      recommendationGenres,
      recommendationActivityCount,
      recommendationStatus,
      recommendationError,
      register,
      login,
      logout,
      loadAccountCollection,
      saveAccountMovie,
      updateAccountMovie,
      removeAccountMovie,
      loadRecommendations,
      updateProfile,
      getFriends,
      sendFriendRequest,
      acceptFriendRequest,
      removeFriend,
      getMovieNightMatch,
    }),
    [
      user,
      authStatus,
      accountMovies,
      cinemaStatus,
      cinemaError,
      recommendations,
      recommendationGenres,
      recommendationActivityCount,
      recommendationStatus,
      recommendationError,
      register,
      login,
      logout,
      loadAccountCollection,
      saveAccountMovie,
      updateAccountMovie,
      removeAccountMovie,
      loadRecommendations,
      updateProfile,
      getFriends,
      sendFriendRequest,
      acceptFriendRequest,
      removeFriend,
      getMovieNightMatch,
    ],
  );

  return (
    <CineTrackContext.Provider value={value}>
      {children}
    </CineTrackContext.Provider>
  );
}

export function useCineTrack() {
  const context = useContext(CineTrackContext);
  if (!context) {
    throw new Error("useCineTrack must be used inside CineTrackProvider.");
  }

  return context;
}
