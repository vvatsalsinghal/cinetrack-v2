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
import { clearSavedMovies, readSavedMovies } from "@/lib/myCinema";

const DEFAULT_API_URL = "http://localhost:4000";
const CineTrackContext = createContext(null);

class CineTrackApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CineTrackApiError";
    this.status = status;
  }
}

/**
 * Returns the base backend API URL from env or falls back to localhost.
 */
function getApiUrl() {
  const value = process.env.NEXT_PUBLIC_CINETRACK_API_URL?.trim() || DEFAULT_API_URL;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return DEFAULT_API_URL;
  }
}

/**
 * Generic API request helper with error handling and credentials.
 */
async function apiRequest(path, options = {}) {
  const url = `${getApiUrl()}${path}`;
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error(
      "Could not connect to the CineTrack API. Check that it is running and try again.",
    );
  }

  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      throw new Error("The CineTrack API returned an unreadable response.");
    }
  }

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `The CineTrack API returned HTTP ${response.status}.`;
    throw new CineTrackApiError(message, response.status);
  }

  return payload;
}

export function CineTrackProvider({ children }) {
  // authVersion avoids race conditions when switching accounts
  const authVersion = useRef(0);

  // Authentication state
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking");

  // User's movie collection state
  const [accountMovies, setAccountMovies] = useState([]);
  const [cinemaStatus, setCinemaStatus] = useState("loading");
  const [cinemaError, setCinemaError] = useState("");

  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationGenres, setRecommendationGenres] = useState([]);
  const [recommendationActivityCount, setRecommendationActivityCount] = useState(0);
  const [recommendationStatus, setRecommendationStatus] = useState("idle");
  const [recommendationError, setRecommendationError] = useState("");

  // Fetches user's saved movies and auto-syncs any local offline records
  const loadAccountCollection = useCallback(async () => {
    const expectedVersion = authVersion.current;
    setCinemaStatus("loading");
    setCinemaError("");

    try {
      const payload = await apiRequest("/api/me/cinema");
      if (expectedVersion !== authVersion.current) return;

      const remoteMovies = Array.isArray(payload?.movies) ? payload.movies : [];

      // Check for offline movies to migrate into user account
      let localMovies = [];
      try {
        localMovies = readSavedMovies();
      } catch (err) {
        setAccountMovies(remoteMovies);
        setCinemaStatus("ready");
        setCinemaError(
          err instanceof Error
            ? `${err.message} Sign out only after recovering these local records.`
            : "Local records could not be checked for import.",
        );
        return;
      }

      // If no local movies to import, we're done
      if (localMovies.length === 0) {
        setAccountMovies(remoteMovies);
        setCinemaStatus("ready");
        return;
      }

      // Import local movies into user's account
      const importPayload = await apiRequest("/api/me/cinema/import", {
        method: "POST",
        body: JSON.stringify({ movies: localMovies }),
      });

      if (expectedVersion !== authVersion.current) return;

      clearSavedMovies();
      const importedMovies = Array.isArray(importPayload?.movies)
        ? importPayload.movies
        : remoteMovies;
      setAccountMovies(importedMovies);
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

  // Fetches personalized recommendations based on library activity
  const loadRecommendations = useCallback(async () => {
    const expectedVersion = authVersion.current;
    setRecommendationStatus("loading");
    setRecommendationError("");

    try {
      const result = await apiRequest("/api/me/recommendations", {
        cache: "no-store",
      });
      if (expectedVersion !== authVersion.current) return;

      setRecommendations(Array.isArray(result?.movies) ? result.movies : []);
      setRecommendationGenres(Array.isArray(result?.basedOn) ? result.basedOn : []);
      setRecommendationActivityCount(
        typeof result?.activityCount === "number" ? result.activityCount : 0,
      );
      setRecommendationStatus("ready");
    } catch (error) {
      if (expectedVersion !== authVersion.current) return;

      setRecommendationStatus("error");
      setRecommendationError(
        error instanceof Error
          ? error.message
          : "Personalized recommendations could not be loaded.",
      );
    }
  }, []);

  // Sets active user and triggers library & recommendations fetch
  const activateAccount = useCallback(
    async (nextUser, expectedVersion) => {
      if (!nextUser || typeof nextUser !== "object") return;
      if (expectedVersion !== authVersion.current) return;

      setUser(nextUser);
      setAuthStatus("authenticated");
      await loadAccountCollection();
      await loadRecommendations();
    },
    [loadAccountCollection, loadRecommendations],
  );

  // Check existing session on initial mount
  useEffect(() => {
    let cancelled = false;
    const expectedVersion = authVersion.current;

    async function checkAuthSession() {
      try {
        const payload = await apiRequest("/api/auth/me");
        if (!cancelled && expectedVersion === authVersion.current && payload?.user) {
          await activateAccount(payload.user, expectedVersion);
        }
      } catch (error) {
        if (cancelled || expectedVersion !== authVersion.current) return;

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

    checkAuthSession();
    return () => {
      cancelled = true;
    };
  }, [activateAccount]);

  // Auth actions
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
    if (payload?.user) {
      setUser(payload.user);
    }
    return payload?.user;
  }, []);

  // Library actions
  const saveAccountMovie = useCallback(
    async (movie) => {
      const expectedVersion = authVersion.current;
      const payload = await apiRequest("/api/me/cinema", {
        method: "POST",
        body: JSON.stringify(movie),
      });

      if (payload?.movie && expectedVersion === authVersion.current) {
        setAccountMovies((current) => [
          payload.movie,
          ...current.filter((item) => item.id !== payload.movie.id),
        ]);
        loadRecommendations();
      }
    },
    [loadRecommendations],
  );

  const updateAccountMovie = useCallback(
    async (movieId, changes) => {
      const expectedVersion = authVersion.current;
      const payload = await apiRequest(`/api/me/cinema/${movieId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });

      if (payload?.movie && expectedVersion === authVersion.current) {
        setAccountMovies((current) =>
          current.map((m) => (m.id === movieId ? payload.movie : m)),
        );
        loadRecommendations();
      }
    },
    [loadRecommendations],
  );

  const removeAccountMovie = useCallback(
    async (movieId) => {
      const expectedVersion = authVersion.current;
      await apiRequest(`/api/me/cinema/${movieId}`, { method: "DELETE" });

      if (expectedVersion === authVersion.current) {
        setAccountMovies((current) => current.filter((m) => m.id !== movieId));
        loadRecommendations();
      }
    },
    [loadRecommendations],
  );

  // Social / Friends actions
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
