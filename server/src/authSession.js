import { createHash, randomBytes } from "node:crypto";
import { Session } from "./models/Session.js";
import { User } from "./models/User.js";

export const SESSION_COOKIE_NAME = "cinetrack_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionToken(request) {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== SESSION_COOKIE_NAME) {
      continue;
    }

    const value = cookie.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  }

  return null;
}

export async function createUserSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function getUserForSession(token) {
  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");

  if (!session) {
    return null;
  }

  const user = await User.findById(session.userId);

  if (!user) {
    await session.deleteOne();
    return null;
  }

  return user;
}

export async function deleteUserSession(token) {
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

export function setSessionCookie(response, token, expiresAt) {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_PROJECT_ID);

  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    isProduction ? "SameSite=None" : "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (isProduction) {
    attributes.push("Secure");
    attributes.push("Partitioned");
  }

  response.setHeader("Set-Cookie", attributes.join("; "));
}

export function clearSessionCookie(response) {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_PROJECT_ID);

  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    isProduction ? "SameSite=None" : "SameSite=Lax",
    "Max-Age=0",
  ];

  if (isProduction) {
    attributes.push("Secure");
    attributes.push("Partitioned");
  }

  response.setHeader("Set-Cookie", attributes.join("; "));
}
