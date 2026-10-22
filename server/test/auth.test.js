import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { createRateLimiter } from "../src/rateLimit.js";
import { CinemaEntry } from "../src/models/CinemaEntry.js";
import { Session } from "../src/models/Session.js";
import { User } from "../src/models/User.js";

const databaseName = `cinetrack_stage08_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
let baseUrl;
let server;
let recommendationCalls;

before(async () => {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required to run the account integration tests.");
  }

  const testUri = new URL(uri);
  testUri.pathname = `/${databaseName}`;
  await mongoose.connect(testUri.toString(), {
    serverSelectionTimeoutMS: 5000,
  });
  await Promise.all([User.init(), Session.init(), CinemaEntry.init()]);

  recommendationCalls = [];
  server = createApp({
    movieRecommendations: async (entries) => {
      recommendationCalls.push(entries.map((entry) => entry.tmdbId));
      return {
        activityCount: entries.length,
        basedOn: [{ id: 18, name: "Drama" }],
        movies: [
          {
            id: "tmdb-20",
            tmdbId: 20,
            title: "Recommended title",
            format: "Film",
            source: "tmdb",
            posterUrl: null,
            releaseYear: "2020",
          },
        ],
      };
    },
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

function sessionCookie(response) {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "expected the API to set a session cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  return setCookie.split(";", 1)[0];
}

function withCookie(cookie) {
  return { headers: { Cookie: cookie } };
}

describe("account and My Cinema persistence", () => {
  it("registers, authenticates, imports, isolates, and deletes private collection data", async () => {
    const email = `stage08-${randomUUID()}@example.test`;
    const password = "my-private-cinema-password";
    const localMovie = {
      id: 329865,
      title: "Arrival",
      posterUrl: "https://image.tmdb.org/t/p/w500/arrival.jpg",
      releaseYear: "2016",
      status: "watching",
      rating: 5,
      review: "Saved privately before registration.",
    };

    const rejectedSave = await fetch(`${baseUrl}/api/me/cinema`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(localMovie),
    });
    assert.equal(rejectedSave.status, 401);
    const rejectedRecommendations = await fetch(
      `${baseUrl}/api/me/recommendations`,
    );
    assert.equal(rejectedRecommendations.status, 401);
    assert.deepEqual(recommendationCalls, []);

    const invalidRegistration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "short" }),
    });
    assert.equal(invalidRegistration.status, 400);

    const oversizedPassword = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `stage08-${randomUUID()}@example.test`,
        password: "🎥".repeat(19),
      }),
    });
    assert.equal(oversizedPassword.status, 400);

    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(registration.status, 201);
    const registrationPayload = await registration.json();
    assert.equal(registrationPayload.user.email, email);
    assert.match(registrationPayload.user.id, /^[a-f\d]{24}$/);
    const firstCookie = sessionCookie(registration);
    const rawToken = firstCookie.split("=")[1];
    const storedSession = await Session.findOne({
      userId: registrationPayload.user.id,
    }).select("+tokenHash");
    assert.ok(storedSession);
    assert.notEqual(storedSession.tokenHash, rawToken);
    assert.match(storedSession.tokenHash, /^[a-f\d]{64}$/);

    const duplicateRegistration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toUpperCase(), password }),
    });
    assert.equal(duplicateRegistration.status, 409);

    const currentAccount = await fetch(
      `${baseUrl}/api/auth/me`,
      withCookie(firstCookie),
    );
    assert.equal(currentAccount.status, 200);
    assert.deepEqual(await currentAccount.json(), {
      user: registrationPayload.user,
    });

    const saved = await fetch(`${baseUrl}/api/me/cinema`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: firstCookie,
      },
      body: JSON.stringify(localMovie),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).movie.status, "watching");

    const recommendations = await fetch(
      `${baseUrl}/api/me/recommendations`,
      withCookie(firstCookie),
    );
    assert.equal(recommendations.status, 200);
    assert.equal(recommendations.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await recommendations.json(), {
      activityCount: 1,
      basedOn: [{ id: 18, name: "Drama" }],
      movies: [
        {
          id: "tmdb-20",
          tmdbId: 20,
          title: "Recommended title",
          format: "Film",
          source: "tmdb",
          posterUrl: null,
          releaseYear: "2020",
        },
      ],
    });
    assert.deepEqual(recommendationCalls, [[329865]]);

    const update = await fetch(`${baseUrl}/api/me/cinema/329865`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: firstCookie,
      },
      body: JSON.stringify({
        status: "finished",
        rating: 4,
        review: "Updated after registration.",
      }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual((await update.json()).movie, {
      ...localMovie,
      status: "finished",
      rating: 4,
      review: "Updated after registration.",
    });

    const importResponse = await fetch(`${baseUrl}/api/me/cinema/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: firstCookie,
      },
      body: JSON.stringify({
        movies: [
          { ...localMovie, title: "Local Arrival", status: "saved" },
          {
            id: 550,
            title: "Fight Club",
            posterUrl: null,
            releaseYear: "1999",
          },
        ],
      }),
    });
    assert.equal(importResponse.status, 200);
    const importedMovies = (await importResponse.json()).movies;
    assert.equal(importedMovies.length, 2);
    assert.deepEqual(
      importedMovies.find((movie) => movie.id === 329865),
      {
        ...localMovie,
        status: "finished",
        rating: 4,
        review: "Updated after registration.",
      },
    );

    const secondEmail = `stage08-${randomUUID()}@example.test`;
    const secondRegistration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: secondEmail,
        password,
      }),
    });
    assert.equal(secondRegistration.status, 201);
    const secondCookie = sessionCookie(secondRegistration);

    const secondCollection = await fetch(
      `${baseUrl}/api/me/cinema`,
      withCookie(secondCookie),
    );
    assert.deepEqual(await secondCollection.json(), { movies: [] });

    for (const method of ["PATCH", "DELETE"]) {
      const response = await fetch(`${baseUrl}/api/me/cinema/329865`, {
        method,
        headers: {
          ...(method === "PATCH"
            ? { "Content-Type": "application/json" }
            : {}),
          Cookie: secondCookie,
        },
        ...(method === "PATCH"
          ? { body: JSON.stringify({ status: "saved" }) }
          : {}),
      });
      assert.equal(response.status, 404, `${method} must be user-scoped`);
    }

    const deleted = await fetch(`${baseUrl}/api/me/cinema/329865`, {
      method: "DELETE",
      headers: { Cookie: firstCookie },
    });
    assert.equal(deleted.status, 204);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: firstCookie },
    });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);

    const expiredAccount = await fetch(
      `${baseUrl}/api/auth/me`,
      withCookie(firstCookie),
    );
    assert.equal(expiredAccount.status, 401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).user.email, email);
    sessionCookie(login);
  });

  it("updates user handles, display names, collection privacy, and serves public collections", async () => {
    const email = `sharing-${randomUUID()}@example.test`;
    const password = "secure-password-123";

    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, handle: "cine_alex" }),
    });
    assert.equal(registration.status, 201);
    const regPayload = await registration.json();
    assert.equal(regPayload.user.handle, "cine_alex");
    assert.equal(regPayload.user.collectionPrivacy, "private");
    const cookie = sessionCookie(registration);

    // Rejects duplicate handle
    const dupRegister = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `dup-${randomUUID()}@example.test`,
        password,
        handle: "cine_alex",
      }),
    });
    assert.equal(dupRegister.status, 409);

    // Updates profile
    const update = await fetch(`${baseUrl}/api/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        handle: "alex_cinephile",
        displayName: "Alex R.",
        collectionPrivacy: "public",
      }),
    });
    assert.equal(update.status, 200);
    const updatedUser = await update.json();
    assert.equal(updatedUser.user.handle, "alex_cinephile");
    assert.equal(updatedUser.user.displayName, "Alex R.");
    assert.equal(updatedUser.user.collectionPrivacy, "public");

    // Add movie to collection
    const addMovie = await fetch(`${baseUrl}/api/me/cinema`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        id: 329865,
        title: "Arrival",
        posterUrl: "https://image.tmdb.org/t/p/w500/arrival.jpg",
        releaseYear: "2016",
        status: "finished",
        rating: 5,
        review: "Secret private notes.",
      }),
    });
    assert.equal(addMovie.status, 200);

    // Public collection access
    const publicView = await fetch(`${baseUrl}/api/users/alex_cinephile/cinema`);
    assert.equal(publicView.status, 200);
    const publicData = await publicView.json();
    assert.equal(publicData.user.handle, "alex_cinephile");
    assert.equal(publicData.user.displayName, "Alex R.");
    assert.equal(publicData.movies.length, 1);
    assert.equal(publicData.movies[0].title, "Arrival");
    assert.equal(publicData.movies[0].rating, 5);
    assert.equal(publicData.movies[0].review, undefined);

    // Change to private
    await fetch(`${baseUrl}/api/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ collectionPrivacy: "private" }),
    });

    const privateView = await fetch(`${baseUrl}/api/users/alex_cinephile/cinema`);
    assert.equal(privateView.status, 403);

    // Owner can still view
    const ownerView = await fetch(`${baseUrl}/api/users/alex_cinephile/cinema`, {
      headers: { Cookie: cookie },
    });
    assert.equal(ownerView.status, 200);
  });

  it("manages friend requests, connections, and friend-scoped cinema visibility", async () => {
    // User A: user_a
    const emailA = `friend-a-${randomUUID()}@example.test`;
    const handleA = `usera_${Date.now().toString(36)}`;
    const regA = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailA,
        password: "password123456",
        handle: handleA,
      }),
    });
    assert.equal(regA.status, 201);
    const userA = (await regA.json()).user;
    const cookieA = regA.headers.get("set-cookie").split(";")[0];

    // User B: user_b
    const emailB = `friend-b-${randomUUID()}@example.test`;
    const handleB = `userb_${Date.now().toString(36)}`;
    const regB = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailB,
        password: "password123456",
        handle: handleB,
      }),
    });
    assert.equal(regB.status, 201);
    const userB = (await regB.json()).user;
    const cookieB = regB.headers.get("set-cookie").split(";")[0];

    // User A sets collection privacy to "friends" and adds a movie
    await fetch(`${baseUrl}/api/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ collectionPrivacy: "friends" }),
    });

    await fetch(`${baseUrl}/api/me/cinema`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        id: 157336,
        title: "Interstellar",
        posterUrl: "https://image.tmdb.org/t/p/w500/interstellar.jpg",
        releaseYear: "2014",
        status: "finished",
        rating: 5,
        review: "Must-watch sci-fi.",
      }),
    });

    // Anonymous cannot view friends-only collection
    const anonRes = await fetch(`${baseUrl}/api/users/${userA.handle}/cinema`);
    assert.equal(anonRes.status, 403);

    // User B (not yet friend) cannot view
    const notFriendRes = await fetch(
      `${baseUrl}/api/users/${userA.handle}/cinema`,
      {
        headers: { Cookie: cookieB },
      },
    );
    assert.equal(notFriendRes.status, 403);

    // User B sends friend request to User A
    const reqRes = await fetch(`${baseUrl}/api/friends/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({ handle: userA.handle }),
    });
    assert.equal(reqRes.status, 201);
    const reqData = await reqRes.json();
    assert.equal(reqData.status, "pending");

    // Cannot send duplicate pending request
    const dupRes = await fetch(`${baseUrl}/api/friends/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({ handle: userA.handle }),
    });
    assert.equal(dupRes.status, 409);

    // User A checks friend list -> sees incoming request
    const listA = await fetch(`${baseUrl}/api/friends`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(listA.status, 200);
    const listAData = await listA.json();
    assert.equal(listAData.incoming.length, 1);
    assert.equal(listAData.incoming[0].requester.handle, userB.handle);
    const friendshipId = listAData.incoming[0].id;

    // User A accepts friend request
    const acceptRes = await fetch(
      `${baseUrl}/api/friends/${friendshipId}/accept`,
      {
        method: "POST",
        headers: { Cookie: cookieA },
      },
    );
    assert.equal(acceptRes.status, 200);

    // Now User B can view User A's friends-only collection!
    const friendView = await fetch(
      `${baseUrl}/api/users/${userA.handle}/cinema`,
      {
        headers: { Cookie: cookieB },
      },
    );
    assert.equal(friendView.status, 200);
    const friendData = await friendView.json();
    assert.equal(friendData.movies.length, 1);
    assert.equal(friendData.movies[0].title, "Interstellar");
    assert.equal(friendData.movies[0].review, undefined);

    // Both see each other in their friends list
    const friendsOfB = await fetch(`${baseUrl}/api/friends`, {
      headers: { Cookie: cookieB },
    });
    const friendsOfBData = await friendsOfB.json();
    assert.equal(friendsOfBData.friends.length, 1);
    assert.equal(friendsOfBData.friends[0].friend.handle, userA.handle);

    // Test Movie Night Watch Match between User A and User B
    await fetch(`${baseUrl}/api/me/cinema`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        id: 438631,
        title: "Dune",
        posterUrl: "https://image.tmdb.org/t/p/w500/dune.jpg",
        releaseYear: "2021",
        status: "saved",
      }),
    });

    await fetch(`${baseUrl}/api/me/cinema`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({
        id: 438631,
        title: "Dune",
        posterUrl: "https://image.tmdb.org/t/p/w500/dune.jpg",
        releaseYear: "2021",
        status: "saved",
      }),
    });

    const matchRes = await fetch(`${baseUrl}/api/me/match/${userB.handle}`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(matchRes.status, 200);
    const matchData = await matchRes.json();
    assert.equal(matchData.friend.handle, userB.handle);
    assert.equal(matchData.sharedWatchlist.length, 1);
    assert.equal(matchData.sharedWatchlist[0].title, "Dune");

    // Self-match error
    const selfMatch = await fetch(`${baseUrl}/api/me/match/${userA.handle}`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(selfMatch.status, 400);

    // User B removes friendship
    const deleteRes = await fetch(`${baseUrl}/api/friends/${friendshipId}`, {
      method: "DELETE",
      headers: { Cookie: cookieB },
    });
    assert.equal(deleteRes.status, 200);

    // Access is revoked
    const revokedView = await fetch(
      `${baseUrl}/api/users/${userA.handle}/cinema`,
      {
        headers: { Cookie: cookieB },
      },
    );
    assert.equal(revokedView.status, 403);
  });

  it("enforces HTTP security headers and rate limits authentication endpoints", async () => {
    // 1. Verify HTTP security headers
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(healthRes.headers.get("x-frame-options"), "DENY");
    assert.equal(
      healthRes.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
    );

    // 2. Test rate limiting with a dedicated app instance
    const strictLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 2,
      message: "Rate limit reached for test.",
    });

    const securityApp = createApp({
      loginRateLimiter: strictLimiter,
    });

    const secServer = await new Promise((resolve) => {
      const s = securityApp.listen(0, () => resolve(s));
    });

    try {
      const secUrl = `http://localhost:${secServer.address().port}`;

      // Request 1: OK (401 because bad credentials, but not rate limited)
      const res1 = await fetch(`${secUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "wrongpassword123",
        }),
      });
      assert.equal(res1.status, 401);
      assert.equal(res1.headers.get("ratelimit-remaining"), "1");

      // Request 2: OK
      const res2 = await fetch(`${secUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "wrongpassword123",
        }),
      });
      assert.equal(res2.status, 401);
      assert.equal(res2.headers.get("ratelimit-remaining"), "0");

      // Request 3: Exceeds rate limit -> 429
      const res3 = await fetch(`${secUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "wrongpassword123",
        }),
      });
      assert.equal(res3.status, 429);
      assert.ok(res3.headers.get("retry-after"));
      const body = await res3.json();
      assert.equal(body.error, "Rate limit reached for test.");
    } finally {
      await new Promise((resolve) => secServer.close(resolve));
    }
  });
});
