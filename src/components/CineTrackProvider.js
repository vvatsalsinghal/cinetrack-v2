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

/**
 * ==============================================================================
 * CINETRACK GLOBAL PROVIDER & AUTHENTICATION CONTEXT
 * ==============================================================================
 * What this file does:
 * 1. Global State Hub: Holds the currently logged-in user, their movie library,
 *    and personalized recommendations so any component in the app can access them.
 * 2. Express Backend Communication: Sends secure requests with `credentials: "include"`
 *    to attach HttpOnly JWT authentication cookies automatically.
 * 3. Offline-to-Cloud Auto-Sync: When an anonymous user signs in, any movies
 *    they saved in their browser's localStorage are automatically sent to MongoDB.
 * 4. Race Condition Protection: Uses an `authVersion` counter to prevent old
 *    in-flight responses from overwriting fresh state if a user logs in/out quickly.
 * ==============================================================================
 */

// Fallback to local Express port if NEXT_PUBLIC_CINETRACK_API_URL is unset
const DEFAULT_API_URL = "http://localhost:4000";

// Create the React Context object
const CineTrackContext = createContext(null);

// Custom Error to capture API failure messages and HTTP status codes
class CineTrackApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CineTrackApiError";
    this.status = status;
  }
}

/**
 * Helper to determine the Express API base URL.
 * In development: http://localhost:4000
 * In production: https://cinetrack-api-production.up.railway.app
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
 * Universal fetch wrapper for communicating with the Express backend.
 * Key Concepts:
 * - `credentials: "include"`: Crucial! Instructs the browser to send the HttpOnly JWT cookie.
 * - Parses JSON responses and handles empty 204 (No Content) responses safely.
 * - Extracts human-readable error messages sent by the Express server.
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
      credentials: "include", // Automatically attaches JWT session cookies
      headers,
    });
  } catch {
    throw new Error(
      "Could not connect to the CineTrack API. Check that it is running and try again.",
    );
  }

  // Handle responses with no body (e.g., HTTP 204 No Content on DELETE)
  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      throw new Error("The CineTrack API returned an unreadable response.");
    }
  }

  // Throw detailed error if response is not 2xx
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
  /**
   * Concurrency Guard (authVersion):
   * If a user logs in and immediately logs out, two asynchronous requests are flying.
   * If the first request completes AFTER the logout, it could accidentally log the user
   * back in. `authVersion` increments on every action to ensure outdated responses are discarded.
   */
  const authVersion = useRef(0);

  // Authentication State
  // authStatus can be: "checking" (initial probe), "authenticated", "anonymous", or "error"
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking");

  // User's Cloud Movie Collection State (stored in MongoDB)
  const [accountMovies, setAccountMovies] = useState([]);
  const [cinemaStatus, setCinemaStatus] = useState("loading");
  const [cinemaError, setCinemaError] = useState("");

  // Recommendations State (calculated by backend based on library taste signals)
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationGenres, setRecommendationGenres] = useState([]);
  const [recommendationActivityCount, setRecommendationActivityCount] = useState(0);
  const [recommendationStatus, setRecommendationStatus] = useState("idle");
  const [recommendationError, setRecommendationError] = useState("");

  /**
   * Fetches the user's movie collection from MongoDB and auto-migrates
   * any movies that were saved in the browser before signing in.
   */
  const loadAccountCollection = useCallback(async () => {
    const expectedVersion = authVersion.current;
    setCinemaStatus("loading");
    setCinemaError("");

    try {
      // 1. Fetch remote movies from MongoDB
      const payload = await apiRequest("/api/me/cinema");
      if (expectedVersion !== authVersion.current) return;

      const remoteMovies = Array.isArray(payload?.movies) ? payload.movies : [];

      // 2. Check if the user has movies in browser localStorage to import
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

      // 3. If no local offline movies exist, we are done
      if (localMovies.length === 0) {
        setAccountMovies(remoteMovies);
        setCinemaStatus("ready");
        return;
      }

      // 4. Auto-import offline movies into MongoDB account
      const importPayload = await apiRequest("/api/me/cinema/import", {
        method: "POST",
        body: JSON.stringify({ movies: localMovies }),
      });

      if (expectedVersion !== authVersion.current) return;

      // 5. Clear localStorage since records now live safely in the cloud database
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

  /**
   * Fetches AI/algorithm recommendations based on user's highest rated genres.
   */
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

  /**
   * Called upon successful login or registration to activate user state
   * and kick off loading their library and recommendations.
   */
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

  /**
   * Initial App Load Check:
   * When user opens the site, check with Express (/api/auth/me) if their JWT cookie is still valid.
   */
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

        // HTTP 401 Unauthorized simply means the user is not logged in (anonymous)
        if (error instanceof CineTrackApiError && error.status === 401) {
          setUser(null);
          setAuthStatus("anonymous");
          setCinemaStatus("ready");
          return;
        }

        // Backend server offline or network failure
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

  // --- AUTHENTICATION ACTIONS ---

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
    // Reset all user data in state upon logout
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
      const expectedVersion = authVersion.current;
      const payload = await apiRequest("/api/me/cinema", {
        method: "POST",
        body: JSON.stringify(movie),
      });

      if (payload?.movie && expectedVersion === authVersion.current) {
        // Optimistically update React state with the newly saved movie
        setAccountMovies((current) => [
          payload.movie,
          ...current.filter((item) => item.id !== payload.movie.id),
        ]);
        // Refresh taste recommendations to reflect new library entry
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

  // --- SOCIAL / FRIENDS & WATCH MATCH ACTIONS ---

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

  // Memoize the context value object so consumers don't re-render unless values change
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
 * Custom hook for React components to access CineTrack context anywhere.
 * Example usage in any component:
 * const { user, saveAccountMovie } = useCineTrack();
 */
export function useCineTrack() {
  const context = useContext(CineTrackContext);
  if (!context) {
    throw new Error("useCineTrack must be used inside CineTrackProvider.");
  }
  return context;
}
