import express from "express";
import bcrypt from "bcryptjs";
import {
  clearSessionCookie,
  createUserSession,
  deleteUserSession,
  getSessionToken,
  getUserForSession,
  setSessionCookie,
} from "./authSession.js";
import { CinemaEntry } from "./models/CinemaEntry.js";
import { Friendship } from "./models/Friendship.js";
import { Session } from "./models/Session.js";
import { User } from "./models/User.js";
import {
  getMovieDetails,
  getMovieDiscoveryPage,
  getMoviesByGenres,
  getMovieWatchProviders,
  getPopularMovies,
  searchMovies,
  TmdbApiError,
} from "./tmdb.js";
import { getPersonalizedRecommendations } from "./recommendations.js";
import { getMovieNightMatch } from "./match.js";
import { createRateLimiter } from "./rateLimit.js";
import {
  getNewsArticles,
  SUPPORTED_LANGUAGES,
  SUPPORTED_REGIONS,
} from "./news.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 72;
const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const VALID_MOVIE_STATUSES = ["saved", "watching", "finished"];
const TMDB_POSTER_URL =
  /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

export function createApp({
  movieSearch = searchMovies,
  popularMovies = getPopularMovies,
  movieDiscovery = getMovieDiscoveryPage,
  genreDiscovery = getMoviesByGenres,
  movieRecommendations = getPersonalizedRecommendations,
  movieNightMatch = getMovieNightMatch,
  movieDetails = getMovieDetails,
  movieWatchProviders = getMovieWatchProviders,
  newsArticles = getNewsArticles,
  frontendOrigin =
    process.env.CINETRACK_FRONTEND_ORIGIN ?? "http://localhost:3000",
  loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    message: "Too many login attempts. Please try again in 15 minutes.",
  }),
  registerRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    message: "Too many registration attempts. Please try again later.",
  }),
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.use((_request, response, next) => {
    response.set("X-Content-Type-Options", "nosniff");
    response.set("X-Frame-Options", "DENY");
    response.set("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use((request, response, next) => {
    const origin = request.get("origin");

    if (!origin) {
      next();
      return;
    }

    if (origin !== frontendOrigin) {
      response.status(403).json({
        error: "This website is not allowed to access the CineTrack API.",
      });
      return;
    }

    response.set("Access-Control-Allow-Origin", origin);
    response.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    response.set("Access-Control-Allow-Headers", "Accept, Content-Type");
    response.set("Access-Control-Allow-Credentials", "true");
    response.vary("Origin");

    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }

    next();
  });

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "cinetrack-api",
    });
  });

  app.post(
    "/api/auth/register",
    registerRateLimiter,
    async (request, response, next) => {
    const { email, password, handle } = request.body ?? {};
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!isValidEmail(normalizedEmail) || !isValidPassword(password)) {
      response.status(400).json({
        error:
          "Enter a valid email and a password of at least 12 characters (maximum 72 UTF-8 bytes).",
      });
      return;
    }

    let initialHandle;
    if (typeof handle === "string" && handle.trim()) {
      const normalizedHandle = handle.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,30}$/.test(normalizedHandle)) {
        response.status(400).json({
          error:
            "Handle must be 3-30 lowercase alphanumeric characters or underscores.",
        });
        return;
      }
      initialHandle = normalizedHandle;
    } else {
      initialHandle = generateDefaultHandle(normalizedEmail);
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({
        email: normalizedEmail,
        passwordHash,
        handle: initialHandle,
      });
      const session = await createUserSession(user._id);
      setSessionCookie(response, session.token, session.expiresAt);
      response.status(201).json({ user: serializeUser(user) });
    } catch (error) {
      if (error?.code === 11000) {
        const isHandleConflict =
          error?.keyPattern?.handle || error?.message?.includes("handle");
        response.status(409).json({
          error: isHandleConflict
            ? "An account with this handle already exists."
            : "An account with this email already exists.",
        });
        return;
      }

      next(error);
    }
  });

  app.post(
    "/api/auth/login",
    loginRateLimiter,
    async (request, response, next) => {
    const { email, password } = request.body ?? {};
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!isValidEmail(normalizedEmail) || !isValidPassword(password)) {
      response.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    try {
      const user = await User.findOne({ email: normalizedEmail }).select(
        "+passwordHash",
      );
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        response.status(401).json({
          error: "Email or password is incorrect.",
        });
        return;
      }

      const session = await createUserSession(user._id);
      setSessionCookie(response, session.token, session.expiresAt);
      response.json({ user: serializeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        response.status(401).json({ error: "You are not signed in." });
        return;
      }

      response.json({ user: serializeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/auth/profile", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const { handle, displayName, collectionPrivacy } = request.body ?? {};
      const updates = {};

      if (handle !== undefined) {
        if (
          typeof handle !== "string" ||
          !/^[a-z0-9_]{3,30}$/.test(handle.trim().toLowerCase())
        ) {
          response.status(400).json({
            error:
              "Handle must be 3-30 lowercase alphanumeric characters or underscores.",
          });
          return;
        }
        const normalizedHandle = handle.trim().toLowerCase();
        const existing = await User.findOne({
          handle: normalizedHandle,
          _id: { $ne: user._id },
        });
        if (existing) {
          response.status(409).json({
            error: "An account with this handle already exists.",
          });
          return;
        }
        updates.handle = normalizedHandle;
      }

      if (displayName !== undefined) {
        if (
          typeof displayName !== "string" ||
          displayName.trim().length > 50
        ) {
          response.status(400).json({
            error: "Display name must be 50 characters or fewer.",
          });
          return;
        }
        updates.displayName = displayName.trim();
      }

      if (collectionPrivacy !== undefined) {
        if (!["private", "friends", "public"].includes(collectionPrivacy)) {
          response.status(400).json({
            error:
              "Collection privacy must be 'private', 'friends', or 'public'.",
          });
          return;
        }
        updates.collectionPrivacy = collectionPrivacy;
      }

      if (Object.keys(updates).length === 0) {
        response.status(400).json({
          error:
            "Provide a valid handle, displayName, or collectionPrivacy to update.",
        });
        return;
      }

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $set: updates },
        { returnDocument: "after", runValidators: true },
      );

      response.json({ user: serializeUser(updatedUser) });
    } catch (error) {
      if (error?.code === 11000) {
        response.status(409).json({
          error: "An account with this handle already exists.",
        });
        return;
      }
      next(error);
    }
  });

  app.post("/api/auth/logout", async (request, response, next) => {
    try {
      const token = getSessionToken(request);
      if (token) {
        await deleteUserSession(token);
      }

      clearSessionCookie(response);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/me/cinema", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const entries = await CinemaEntry.find({ userId: user._id }).sort({
        updatedAt: -1,
      });
      response.json({ movies: entries.map(serializeCinemaEntry) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/me/recommendations", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      response.set("Cache-Control", "private, no-store");
      const entries = await CinemaEntry.find({ userId: user._id }).sort({
        updatedAt: -1,
      });
      response.json(
        await movieRecommendations(entries, {
          movieDetails,
          discoverMovies: genreDiscovery,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/me/cinema", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const movie = parseCinemaMovie(request.body);
      if (!movie) {
        response.status(400).json({
          error: "Provide valid movie details to save in My Cinema.",
        });
        return;
      }

      const entry = await CinemaEntry.findOneAndUpdate(
        { userId: user._id, tmdbId: movie.tmdbId },
        { $setOnInsert: { userId: user._id, ...movie } },
        {
          returnDocument: "after",
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );
      response.status(200).json({ movie: serializeCinemaEntry(entry) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/me/cinema/import", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const { movies } = request.body ?? {};
      if (
        !Array.isArray(movies) ||
        movies.length > 200 ||
        !movies.every((movie) => parseCinemaMovie(movie))
      ) {
        response.status(400).json({
          error: "Provide up to 200 valid saved movies to import.",
        });
        return;
      }

      if (movies.length > 0) {
        await CinemaEntry.bulkWrite(
          movies.map((movie) => {
            const validatedMovie = parseCinemaMovie(movie);
            return {
              updateOne: {
                filter: {
                  userId: user._id,
                  tmdbId: validatedMovie.tmdbId,
                },
                update: {
                  $setOnInsert: {
                    userId: user._id,
                    ...validatedMovie,
                  },
                },
                upsert: true,
              },
            };
          }),
          { ordered: true },
        );
      }

      const entries = await CinemaEntry.find({ userId: user._id }).sort({
        updatedAt: -1,
      });
      response.json({ movies: entries.map(serializeCinemaEntry) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/me/cinema/:tmdbId", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      if (!/^[1-9]\d{0,9}$/.test(request.params.tmdbId)) {
        response.status(404).json({ error: "Movie not found in My Cinema." });
        return;
      }

      const updates = parseCinemaUpdates(request.body);
      if (!updates) {
        response.status(400).json({
          error: "Provide a valid status, rating, or private note.",
        });
        return;
      }

      const entry = await CinemaEntry.findOneAndUpdate(
        { userId: user._id, tmdbId: Number(request.params.tmdbId) },
        { $set: updates },
        { returnDocument: "after", runValidators: true },
      );
      if (!entry) {
        response.status(404).json({ error: "Movie not found in My Cinema." });
        return;
      }

      response.json({ movie: serializeCinemaEntry(entry) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/me/cinema/:tmdbId", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      if (!/^[1-9]\d{0,9}$/.test(request.params.tmdbId)) {
        response.status(404).json({ error: "Movie not found in My Cinema." });
        return;
      }

      const result = await CinemaEntry.deleteOne({
        userId: user._id,
        tmdbId: Number(request.params.tmdbId),
      });
      if (result.deletedCount === 0) {
        response.status(404).json({ error: "Movie not found in My Cinema." });
        return;
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/:handle/cinema", async (request, response, next) => {
    const { handle } = request.params;
    const normalizedHandle =
      typeof handle === "string" ? handle.trim().toLowerCase() : "";

    if (!/^[a-z0-9_]{3,30}$/.test(normalizedHandle)) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    try {
      const targetUser = await User.findOne({ handle: normalizedHandle });
      if (!targetUser) {
        response.status(404).json({ error: "User not found." });
        return;
      }

      const currentUser = await getAuthenticatedUser(request);
      const isOwner =
        currentUser && currentUser._id.toString() === targetUser._id.toString();

      if (targetUser.collectionPrivacy === "private" && !isOwner) {
        response
          .status(403)
          .json({ error: "This cinema collection is private." });
        return;
      }

      if (targetUser.collectionPrivacy === "friends" && !isOwner) {
        let isFriend = false;
        if (currentUser) {
          isFriend = Boolean(
            await Friendship.exists({
              status: "accepted",
              $or: [
                { requesterId: currentUser._id, recipientId: targetUser._id },
                { requesterId: targetUser._id, recipientId: currentUser._id },
              ],
            }),
          );
        }

        if (!isFriend) {
          response
            .status(403)
            .json({ error: "This cinema collection is only visible to friends." });
          return;
        }
      }

      const entries = await CinemaEntry.find({ userId: targetUser._id }).sort({
        updatedAt: -1,
      });

      response.json({
        user: {
          handle: targetUser.handle,
          displayName: targetUser.displayName || targetUser.handle,
          collectionPrivacy: targetUser.collectionPrivacy,
        },
        movies: entries.map(serializePublicCinemaEntry),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/friends/request", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const { handle } = request.body ?? {};
      const normalizedHandle =
        typeof handle === "string" ? handle.trim().toLowerCase() : "";

      if (!/^[a-z0-9_]{3,30}$/.test(normalizedHandle)) {
        response.status(400).json({
          error: "Provide a valid handle of 3-30 lowercase alphanumeric characters.",
        });
        return;
      }

      const target = await User.findOne({ handle: normalizedHandle });
      if (!target) {
        response.status(404).json({
          error: "No CineTrack user was found with that handle.",
        });
        return;
      }

      if (target._id.equals(user._id)) {
        response.status(400).json({
          error: "You cannot send a friend request to yourself.",
        });
        return;
      }

      const existing = await Friendship.findOne({
        $or: [
          { requesterId: user._id, recipientId: target._id },
          { requesterId: target._id, recipientId: user._id },
        ],
      });

      if (existing) {
        if (existing.status === "accepted") {
          response.status(409).json({
            error: `You are already friends with @${target.handle}.`,
          });
          return;
        }

        if (existing.status === "pending") {
          if (existing.requesterId.equals(user._id)) {
            response.status(409).json({
              error: `A friend request is already pending with @${target.handle}.`,
            });
            return;
          }

          existing.status = "accepted";
          await existing.save();
          response.json({
            status: "accepted",
            friendshipId: existing._id.toString(),
            friend: {
              id: target._id.toString(),
              handle: target.handle,
              displayName: target.displayName || target.handle,
            },
          });
          return;
        }

        if (existing.status === "declined") {
          existing.requesterId = user._id;
          existing.recipientId = target._id;
          existing.status = "pending";
          await existing.save();
          response.status(201).json({
            status: "pending",
            friendshipId: existing._id.toString(),
            recipient: {
              id: target._id.toString(),
              handle: target.handle,
              displayName: target.displayName || target.handle,
            },
          });
          return;
        }
      }

      const friendship = await Friendship.create({
        requesterId: user._id,
        recipientId: target._id,
        status: "pending",
      });

      response.status(201).json({
        status: "pending",
        friendshipId: friendship._id.toString(),
        recipient: {
          id: target._id.toString(),
          handle: target.handle,
          displayName: target.displayName || target.handle,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/friends", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const records = await Friendship.find({
        $or: [{ requesterId: user._id }, { recipientId: user._id }],
      })
        .populate("requesterId", "handle displayName")
        .populate("recipientId", "handle displayName")
        .sort({ updatedAt: -1 });

      const friends = [];
      const incoming = [];
      const outgoing = [];

      for (const record of records) {
        if (!record.requesterId || !record.recipientId) {
          continue;
        }

        if (record.status === "accepted") {
          const isCallerRequester = record.requesterId._id.equals(user._id);
          const friendDoc = isCallerRequester
            ? record.recipientId
            : record.requesterId;
          friends.push({
            id: record._id.toString(),
            friend: {
              id: friendDoc._id.toString(),
              handle: friendDoc.handle,
              displayName: friendDoc.displayName || friendDoc.handle,
            },
            connectedAt: record.updatedAt,
          });
        } else if (record.status === "pending") {
          if (record.recipientId._id.equals(user._id)) {
            incoming.push({
              id: record._id.toString(),
              requester: {
                id: record.requesterId._id.toString(),
                handle: record.requesterId.handle,
                displayName:
                  record.requesterId.displayName || record.requesterId.handle,
              },
              createdAt: record.createdAt,
            });
          } else {
            outgoing.push({
              id: record._id.toString(),
              recipient: {
                id: record.recipientId._id.toString(),
                handle: record.recipientId.handle,
                displayName:
                  record.recipientId.displayName || record.recipientId.handle,
              },
              createdAt: record.createdAt,
            });
          }
        }
      }

      response.json({ friends, incoming, outgoing });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/friends/:id/accept", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const { id } = request.params;
      if (!id || id.length !== 24) {
        response.status(400).json({ error: "Invalid friendship ID." });
        return;
      }

      const friendship = await Friendship.findOne({
        _id: id,
        recipientId: user._id,
        status: "pending",
      });

      if (!friendship) {
        response
          .status(404)
          .json({ error: "Pending friend request not found." });
        return;
      }

      friendship.status = "accepted";
      await friendship.save();

      response.json({ success: true, status: "accepted" });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/friends/:id", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const { id } = request.params;
      if (!id || id.length !== 24) {
        response.status(400).json({ error: "Invalid friendship ID." });
        return;
      }

      const friendship = await Friendship.findOne({
        _id: id,
        $or: [{ requesterId: user._id }, { recipientId: user._id }],
      });

      if (!friendship) {
        response.status(404).json({ error: "Friendship not found." });
        return;
      }

      await friendship.deleteOne();

      response.json({ success: true, message: "Friendship removed." });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/me/match/:friendHandle", async (request, response, next) => {
    try {
      const user = await requireAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const { friendHandle } = request.params;
      const normalizedHandle =
        typeof friendHandle === "string" ? friendHandle.trim().toLowerCase() : "";

      if (!/^[a-z0-9_]{3,30}$/.test(normalizedHandle)) {
        response.status(400).json({ error: "Invalid friend handle." });
        return;
      }

      const friend = await User.findOne({ handle: normalizedHandle });
      if (!friend) {
        response.status(404).json({ error: "Friend not found." });
        return;
      }

      if (friend._id.equals(user._id)) {
        response
          .status(400)
          .json({ error: "Cannot generate Movie Night Match with yourself." });
        return;
      }

      const isFriend = await Friendship.exists({
        status: "accepted",
        $or: [
          { requesterId: user._id, recipientId: friend._id },
          { requesterId: friend._id, recipientId: user._id },
        ],
      });

      if (!isFriend) {
        response.status(403).json({
          error: `You can only generate a Movie Night Match with accepted friends. @${friend.handle} is not on your friends list.`,
        });
        return;
      }

      const [userEntries, friendEntries] = await Promise.all([
        CinemaEntry.find({ userId: user._id }),
        CinemaEntry.find({ userId: friend._id }),
      ]);

      const matchData = await movieNightMatch(userEntries, friendEntries, {
        movieDetails,
        discoverMovies: genreDiscovery,
      });

      response.json({
        friend: {
          id: friend._id.toString(),
          handle: friend.handle,
          displayName: friend.displayName || friend.handle,
        },
        sharedWatchlist: matchData.sharedWatchlist,
        commonGenres: matchData.commonGenres,
        recommendations: matchData.recommendations,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/movies/search", async (request, response, next) => {
    const { q } = request.query;

    if (typeof q !== "string" || !q.trim()) {
      response.status(400).json({
        error: "Provide a movie title in the q query parameter.",
      });
      return;
    }

    try {
      response.json(await movieSearch(q.trim()));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/movies/popular", async (request, response, next) => {
    const pageValue = request.query.page ?? "1";

    if (
      typeof pageValue !== "string" ||
      !/^[1-9]\d{0,2}$/.test(pageValue) ||
      Number(pageValue) > 500
    ) {
      response.status(400).json({
        error: "Provide a page number between 1 and 500.",
      });
      return;
    }

    const page = Number(pageValue);

    try {
      response.json(await popularMovies(page));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/movies/discover", async (request, response, next) => {
    const pageValue = request.query.page ?? "1";
    const mood = request.query.mood ?? "";
    const maxRuntime = request.query.runtime ?? "";

    if (
      typeof pageValue !== "string" ||
      !/^[1-9]\d{0,2}$/.test(pageValue) ||
      typeof mood !== "string" ||
      typeof maxRuntime !== "string"
    ) {
      response.status(400).json({
        error: "Provide one valid page, mood, and runtime value.",
      });
      return;
    }

    try {
      response.json(
        await movieDiscovery({
          page: Number(pageValue),
          mood,
          maxRuntime,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/movies/:id/watch-providers", async (request, response, next) => {
    const { id } = request.params;

    if (!/^[1-9]\d{0,9}$/.test(id)) {
      response.status(404).json({ error: "Movie not found." });
      return;
    }

    try {
      response.json(await movieWatchProviders(id));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/movies/:id", async (request, response, next) => {
    const { id } = request.params;

    if (!/^[1-9]\d{0,9}$/.test(id)) {
      response.status(404).json({ error: "Movie not found." });
      return;
    }

    try {
      response.json(await movieDetails(id));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/news", async (request, response, next) => {
    const { region = "all", language = "all", limit: limitQuery = "20" } =
      request.query;

    if (typeof region !== "string" || !SUPPORTED_REGIONS.includes(region)) {
      response.status(400).json({
        error: "Provide a valid region: all, india, or global.",
      });
      return;
    }

    if (
      typeof language !== "string" ||
      !SUPPORTED_LANGUAGES.includes(language)
    ) {
      response.status(400).json({
        error: "Provide a valid language: all, en, hi, ta, or te.",
      });
      return;
    }

    if (
      typeof limitQuery !== "string" ||
      !/^[1-9]\d{0,1}$/.test(limitQuery) ||
      Number(limitQuery) > 50
    ) {
      response.status(400).json({
        error: "Provide a limit between 1 and 50.",
      });
      return;
    }

    try {
      response.set("Cache-Control", "public, max-age=300");
      const result = await newsArticles({
        region,
        language,
        limit: Number(limitQuery),
      });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: "API route not found.",
    });
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof TmdbApiError) {
      response.status(error.status).json({ error: error.message });
      return;
    }

    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Request body must be valid JSON." });
      return;
    }

    if (error?.name === "ValidationError") {
      response.status(400).json({ error: "The submitted data is invalid." });
      return;
    }

    console.error("Unhandled CineTrack API error:", error);
    response.status(500).json({
      error: "The API could not complete the request.",
    });
  });

  return app;
}

async function getAuthenticatedUser(request) {
  const token = getSessionToken(request);
  return token ? getUserForSession(token) : null;
}

async function requireAuthenticatedUser(request, response) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    response.status(401).json({ error: "Sign in to access My Cinema." });
    return null;
  }

  return user;
}

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    EMAIL_PATTERN.test(email)
  );
}

function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES
  );
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    handle: user.handle ?? null,
    displayName: user.displayName ?? "",
    collectionPrivacy: user.collectionPrivacy ?? "private",
  };
}

function serializePublicCinemaEntry(entry) {
  return {
    id: entry.tmdbId,
    title: entry.title,
    posterUrl: entry.posterUrl,
    releaseYear: entry.releaseYear,
    status: entry.status,
    rating: entry.rating,
  };
}

function generateDefaultHandle(email) {
  const prefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
  const base = prefix.length >= 3 ? prefix.slice(0, 18) : "cinema";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}_${suffix}`.slice(0, 30);
}

function parseCinemaMovie(movie) {
  if (
    typeof movie !== "object" ||
    movie === null ||
    !Number.isSafeInteger(movie.id) ||
    movie.id < 1 ||
    typeof movie.title !== "string" ||
    !movie.title.trim() ||
    movie.title.trim().length > 200 ||
    (movie.posterUrl !== null &&
      (typeof movie.posterUrl !== "string" ||
        !TMDB_POSTER_URL.test(movie.posterUrl))) ||
    (movie.releaseYear !== null &&
      (typeof movie.releaseYear !== "string" ||
        !/^\d{4}$/.test(movie.releaseYear))) ||
    (movie.status !== undefined &&
      !VALID_MOVIE_STATUSES.includes(movie.status)) ||
    (movie.rating !== undefined &&
      movie.rating !== null &&
      (!Number.isInteger(movie.rating) ||
        movie.rating < 1 ||
        movie.rating > 5)) ||
    (movie.review !== undefined &&
      (typeof movie.review !== "string" ||
        movie.review.trim().length > 500))
  ) {
    return null;
  }

  return {
    tmdbId: movie.id,
    title: movie.title.trim(),
    posterUrl: movie.posterUrl ?? null,
    releaseYear: movie.releaseYear ?? null,
    status: movie.status ?? "saved",
    rating: movie.rating ?? null,
    review: movie.review?.trim() ?? "",
  };
}

function parseCinemaUpdates(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  const updates = {};
  if (Object.hasOwn(body, "status")) {
    if (!VALID_MOVIE_STATUSES.includes(body.status)) {
      return null;
    }
    updates.status = body.status;
  }

  if (Object.hasOwn(body, "rating")) {
    if (
      body.rating !== null &&
      (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
    ) {
      return null;
    }
    updates.rating = body.rating;
  }

  if (Object.hasOwn(body, "review")) {
    if (
      typeof body.review !== "string" ||
      body.review.trim().length > 500
    ) {
      return null;
    }
    updates.review = body.review.trim();
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

function serializeCinemaEntry(entry) {
  return {
    id: entry.tmdbId,
    title: entry.title,
    posterUrl: entry.posterUrl,
    releaseYear: entry.releaseYear,
    status: entry.status,
    rating: entry.rating,
    review: entry.review,
  };
}
