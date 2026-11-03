"use client";

/**
 * ==============================================================================
 * CINETRACK GLOBAL CONTEXT & AUTHENTICATION PROVIDER
 * ==============================================================================
 * 
 * WHAT THIS FILE DOES:
 * Serves as the central state hub for the entire CineTrack app:
 * 1. User Session: Tracks logged-in user and auth status ("checking", "authenticated", "anonymous", "error").
 * 2. Cloud Movie Collection: Syncs saved movies with MongoDB on the Express backend.
 * 3. Offline-to-Cloud Auto-Sync: Automatically moves any movies saved in browser localStorage
 *    into MongoDB as soon as the user logs in or registers.
 * 4. Personalized Recommendations: Fetches smart recommendations based on library genre taste.
 * 5. Friends & Social: Powers friend requests and the "Movie Night Watch Match" feature.
 * ==============================================================================
 */

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

// Custom Error class that retains the HTTP status code (e.g. 401 Unauthorized)
class CineTrackApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CineTrackApiError";
    this.status = status;
  }
}

// Resolves backend URL from environment or defaults to localhost
function getApiUrl() {
  const value = process.env.NEXT_PUBLIC_CINETRACK_API_URL?.trim() || DEFAULT_API_URL;
  try {
    return new URL(value).origin;
  } catch {
    return DEFAULT_API_URL;
  }
}

/**
 * Universal backend fetch wrapper:
 * Automatically includes credentials ("include") so the browser attaches the
 * httpOnly JWT session cookie to every request.
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
      credentials: "include", // Attaches JWT auth cookie
      headers,
    });
  } catch {
    throw new Error("Could not connect to the CineTrack API. Check that it is running and try again.");
  }

  // Handle empty 204 No Content responses (e.g. DELETE requests)
  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The CineTrack API returned an unreadable response.");
  }

  if (!response.ok) {
    const message = payload?.error || `The CineTrack API returned HTTP ${response.status}.`;
    throw new CineTrackApiError(message, response.status);
  }

  return payload;
}

export function CineTrackProvider({ children }) {
  // authVersion avoids race conditions if a user logs in and out quickly
  const authVersion = useRef(0);

  // Authentication State
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking"); // 'checking' | 'authenticated' | 'anonymous' | 'error'

  // Cloud Library State (MongoDB)
  const [accountMovies, setAccountMovies] = useState([]);
  const [cinemaStatus, setCinemaStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [cinemaError, setCinemaError] = useState("");

  // Taste Recommendations State
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationGenres, setRecommendationGenres] = useState([]);
  const [recommendationActivityCount, setRecommendationActivityCount] = useState(0);
  const [recommendationStatus, setRecommendationStatus] = useState("idle"); // 'idle' | 'loading' | 'ready' | 'error'
  const [recommendationError, setRecommendationError] = useState("");

  /**
   * Loads the user's movie library from MongoDB and auto-imports any
   * offline movies that were saved in browser localStorage while logged out.
   */
  const loadAccountCollection = useCallback(async () => {
    const version = authVersion.current;
    setCinemaStatus("loading");
    setCinemaError("");

    try {
      const payload = await apiRequest("/api/me/cinema");
      if (version !== authVersion.current) return;

      const remoteMovies = Array.isArray(payload?.movies) ? payload.movies : [];

      // Check if there are offline movies saved in localStorage
      let localMovies = [];
      try {
        localMovies = readSavedMovies();
      } catch (err) {
        setAccountMovies(remoteMovies);
        setCinemaStatus("ready");
        setCinemaError(err instanceof Error ? err.message : "Local records could not be read.");
        return;
      }

      // If no local movies to import, we're done
      if (localMovies.length === 0) {
        setAccountMovies(remoteMovies);
        setCinemaStatus("ready");
        return;
      }

      // Auto-import local movies into MongoDB
      const importPayload = await apiRequest("/api/me/cinema/import", {
        method: "POST",
        body: JSON.stringify({ movies: localMovies }),
      });

      if (version !== authVersion.current) return;

      clearSavedMovies(); // Clear browser storage now that items are safely in MongoDB
      setAccountMovies(Array.isArray(importPayload?.movies) ? importPayload.movies : remoteMovies);
      setCinemaStatus("ready");
    } catch (error) {
      if (version === authVersion.current) {
        setCinemaStatus("error");
        setCinemaError(error instanceof Error ? error.message : "My Cinema could not be loaded.");
      }
    }
  }, []);

  /**
   * Fetches personalized movie recommendations based on user library activity.
   */
  const loadRecommendations = useCallback(async () => {
    const version = authVersion.current;
    setRecommendationStatus("loading");
    setRecommendationError("");

    try {
      const result = await apiRequest("/api/me/recommendations", { cache: "no-store" });
      if (version !== authVersion.current) return;

      setRecommendations(Array.isArray(result?.movies) ? result.movies : []);
      setRecommendationGenres(Array.isArray(result?.basedOn) ? result.basedOn : []);
      setRecommendationActivityCount(typeof result?.activityCount === "number" ? result.activityCount : 0);
      setRecommendationStatus("ready");
    } catch (error) {
      if (version !== authVersion.current) return;
      setRecommendationStatus("error");
      setRecommendationError(error instanceof Error ? error.message : "Recommendations failed to load.");
    }
  }, []);

  /**
   * Sets the active user and triggers background fetching of their collection & recommendations.
   */
  const activateAccount = useCallback(
    async (nextUser, version) => {
      if (!nextUser || version !== authVersion.current) return;
      setUser(nextUser);
      setAuthStatus("authenticated");
      await loadAccountCollection();
      await loadRecommendations();
    },
    [loadAccountCollection, loadRecommendations],
  );

  /**
   * On initial site load, check if the user already has an active JWT session cookie.
   */
  useEffect(() => {
    let cancelled = false;
    const version = authVersion.current;

    async function checkAuthSession() {
      try {
        const payload = await apiRequest("/api/auth/me");
        if (!cancelled && version === authVersion.current && payload?.user) {
          await activateAccount(payload.user, version);
        }
      } catch (error) {
        if (cancelled || version !== authVersion.current) return;

        // 401 simply means guest/logged out
        if (error instanceof CineTrackApiError && error.status === 401) {
          setUser(null);
          setAuthStatus("anonymous");
          setCinemaStatus("ready");
          return;
        }

        // Server unreachable or network error
        setAuthStatus("error");
        setCinemaStatus("ready");
        setCinemaError(error instanceof Error ? error.message : "Your session could not be verified.");
      }
    }

    checkAuthSession();
    return () => {
      cancelled = true;
    };
  }, [activateAccount]);

  // --- AUTHENTICATION ACTIONS ---

  const register = useCallback(
    async ({ email, password }) => {
      const payload = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const version = ++authVersion.current;
      await activateAccount(payload?.user, version);
    },
    [activateAccount],
  );

  const login = useCallback(
    async ({ email, password }) => {
      const payload = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const version = ++authVersion.current;
      await activateAccount(payload?.user, version);
    },
    [activateAccount],
  );

  const logout = useCallback(async () => {
    await apiRequest("/api/auth/logout", { method: "POST" });
    authVersion.current += 1;

    // Reset user state to guest
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

  // --- CLOUD MOVIE LIBRARY ACTIONS ---

  const saveAccountMovie = useCallback(
    async (movie) => {
      const version = authVersion.current;
      const payload = await apiRequest("/api/me/cinema", {
        method: "POST",
        body: JSON.stringify(movie),
      });

      if (payload?.movie && version === authVersion.current) {
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
      const version = authVersion.current;
      const payload = await apiRequest(`/api/me/cinema/${movieId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });

      if (payload?.movie && version === authVersion.current) {
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
      const version = authVersion.current;
      await apiRequest(`/api/me/cinema/${movieId}`, { method: "DELETE" });

      if (version === authVersion.current) {
        setAccountMovies((current) => current.filter((m) => m.id !== movieId));
        loadRecommendations();
      }
    },
    [loadRecommendations],
  );

  // --- SOCIAL / FRIENDS ACTIONS ---

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
    return await apiRequest(`/api/friends/${id}/accept`, { method: "POST" });
  }, []);

  const removeFriend = useCallback(async (id) => {
    return await apiRequest(`/api/friends/${id}`, { method: "DELETE" });
  }, []);

  const getMovieNightMatch = useCallback(async (friendHandle) => {
    return await apiRequest(`/api/me/match/${encodeURIComponent(friendHandle)}`);
  }, []);

  // Memoize the context value
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

/**
 * Custom React hook to access CineTrack context from any component.
 */
export function useCineTrack() {
  const context = useContext(CineTrackContext);
  if (!context) {
    throw new Error("useCineTrack must be used inside CineTrackProvider.");
  }
  return context;
}
