"use client";

import { useEffect, useRef, useState } from "react";
import { useCineTrack } from "@/components/CineTrackProvider";

const baseInputClass =
  "min-h-11 w-full rounded-lg border border-line bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AccountPanel() {
  const {
    user,
    authStatus,
    cinemaError,
    register,
    login,
    logout,
    updateProfile,
  } = useCineTrack();
  const [mode, setMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        await register({ email, password });
      } else {
        await login({ email, password });
      }
      setPassword("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Your account request could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");
    setIsSubmitting(true);
    try {
      await logout();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "You could not be signed out.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authStatus === "checking") {
    return (
      <p role="status" className="text-sm text-muted">
        Checking your account…
      </p>
    );
  }

  if (user) {
    return (
      <section className="max-w-xl rounded-xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">
              <span aria-hidden="true" />
              SIGNED IN
            </p>
            <h2 className="text-xl font-medium">Your CineTrack account</h2>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleLogout}
            className="rounded-lg border border-line px-4 py-2 text-xs text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {isSubmitting ? "Signing out…" : "Sign out"}
          </button>
        </div>

        {cinemaError && (
          <p role="alert" className="mt-5 text-sm leading-6 text-muted">
            {cinemaError}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 text-sm leading-6 text-muted">
            {error}
          </p>
        )}

        <ProfileSettings user={user} updateProfile={updateProfile} />
        <FriendsManager user={user} />
      </section>
    );
  }

  return (
    <section className="max-w-xl rounded-xl border border-line bg-surface p-6 sm:p-8">
      <p className="eyebrow mb-4">
        <span aria-hidden="true" />
        {mode === "register" ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}
      </p>
      <h2 className="text-xl font-medium">
        {mode === "register" ? "Keep your cinema with you." : "Sign in to CineTrack."}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Your collection stays private and syncs through your CineTrack account.
        Existing browser-saved movies are imported after sign-in.
      </p>
      {authStatus === "error" && (
        <p role="alert" className="mt-5 text-sm leading-6 text-muted">
          Your saved browser collection is still available, but account status
          could not be checked. Check that the API and MongoDB are running, then
          reload this page.
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="account-email"
            className="mb-2 block text-xs font-medium text-muted"
          >
            Email
          </label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={baseInputClass}
          />
        </div>
        <div>
          <label
            htmlFor="account-password"
            className="mb-2 block text-xs font-medium text-muted"
          >
            Password
          </label>
          <input
            id="account-password"
            type="password"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            required
            minLength={mode === "register" ? 12 : 1}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={baseInputClass}
          />
          {mode === "register" && (
            <p className="mt-2 text-xs text-muted">
              Use at least 12 characters.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm leading-6 text-muted">
            {error}
          </p>
        )}
        {cinemaError && authStatus === "error" && (
          <p role="alert" className="text-sm leading-6 text-muted">
            {cinemaError}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-accent px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {isSubmitting
            ? "Please wait…"
            : mode === "register"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "register" ? "login" : "register");
          setError("");
        }}
        className="mt-5 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        {mode === "register"
          ? "Already have an account? Sign in"
          : "New to CineTrack? Create an account"}
      </button>
    </section>
  );
}

function ProfileSettings({ user, updateProfile }) {
  const [isEditing, setIsEditing] = useState(!user.handle);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined" && user.handle
      ? `${window.location.origin}/cinema/${user.handle}`
      : `/cinema/${user.handle || ""}`;

  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="mt-8 border-t border-line/70 pt-8">
      {!isEditing && user.handle ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Username
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-semibold text-accent">
                  @{user.handle}
                </span>
                {user.displayName && (
                  <span className="text-sm text-foreground">
                    ({user.displayName})
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Collection privacy:{" "}
                <span className="font-medium capitalize text-foreground">
                  {user.collectionPrivacy || "private"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setMessage("");
              }}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-foreground transition-colors hover:border-accent"
            >
              Edit profile
            </button>
          </div>

          {message && (
            <p role="status" className="text-xs font-medium text-emerald-400">
              {message}
            </p>
          )}

          {user.collectionPrivacy === "public" && (
            <div className="rounded-xl border border-line/80 bg-background/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-accent">
                Your Public Cinema Link
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted">
                {shareUrl}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-foreground transition-colors hover:border-accent"
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a
                  href={`/cinema/${user.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
                >
                  View public collection ↗
                </a>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ProfileEditForm
          user={user}
          updateProfile={updateProfile}
          onDone={() => {
            setIsEditing(false);
            setMessage("Profile saved successfully.");
          }}
          onCancel={user.handle ? () => setIsEditing(false) : null}
        />
      )}
    </div>
  );
}

function ProfileEditForm({ user, updateProfile, onDone, onCancel }) {
  const [handle, setHandle] = useState(user.handle || "");
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [collectionPrivacy, setCollectionPrivacy] = useState(
    user.collectionPrivacy || "private",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleSave(event) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");

    try {
      await updateProfile({
        handle,
        displayName,
        collectionPrivacy,
      });
      onDone();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not update profile.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">
            {user.handle ? "Edit Profile & Sharing" : "Create Unique Username"}
          </h3>
          <p className="mt-1 text-xs text-muted">
            Choose a unique handle to share your collection without revealing
            your email address.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="account-handle"
            className="mb-2 block text-xs font-medium text-muted"
          >
            Handle (3–30 lowercase letters, numbers, or _)
          </label>
          <div className="flex items-center rounded-lg border border-line bg-background px-3">
            <span className="text-sm font-semibold text-accent">@</span>
            <input
              id="account-handle"
              type="text"
              pattern="^[a-zA-Z0-9_]{3,30}$"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              required
              className="min-h-11 w-full bg-transparent px-2 text-sm text-foreground focus:outline-none"
              placeholder="e.g. cinephile"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="account-display-name"
            className="mb-2 block text-xs font-medium text-muted"
          >
            Display name (optional)
          </label>
          <input
            id="account-display-name"
            type="text"
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-line bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            placeholder="e.g. Alex Rivera"
          />
        </div>

        <div>
          <label
            htmlFor="account-privacy"
            className="mb-2 block text-xs font-medium text-muted"
          >
            Collection Privacy
          </label>
          <select
            id="account-privacy"
            value={collectionPrivacy}
            onChange={(e) => setCollectionPrivacy(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-line bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="private">
              Private (Only you can view your collection)
            </option>
            <option value="public">
              Public (Anyone with your link can view)
            </option>
          </select>
        </div>

        {saveError && (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {saveError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save profile"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-lg border border-line px-4 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function FriendsManager() {
  const { getFriends, sendFriendRequest, acceptFriendRequest, removeFriend } =
    useCineTrack();
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [targetHandle, setTargetHandle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeMatchFriend, setActiveMatchFriend] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchFriends() {
      try {
        const result = await getFriends();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load friends list.",
          );
          setLoading(false);
        }
      }
    }

    fetchFriends();
    return () => {
      cancelled = true;
    };
  }, [getFriends]);

  async function refreshFriends() {
    try {
      const result = await getFriends();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reload friends list.",
      );
    }
  }

  async function handleSendRequest(event) {
    event.preventDefault();
    if (!targetHandle.trim()) return;

    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const res = await sendFriendRequest(targetHandle.trim().toLowerCase());
      if (res.status === "accepted") {
        setMessage(
          `You are now friends with @${targetHandle.trim().toLowerCase()}!`,
        );
      } else {
        setMessage(
          `Friend request sent to @${targetHandle.trim().toLowerCase()}.`,
        );
      }
      setTargetHandle("");
      await refreshFriends();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send friend request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAccept(id, handle) {
    setMessage("");
    setError("");
    try {
      await acceptFriendRequest(id);
      setMessage(`Accepted friend request from @${handle}.`);
      await refreshFriends();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not accept request.",
      );
    }
  }

  async function handleRemove(id, handle, isRequest = false) {
    setMessage("");
    setError("");
    try {
      await removeFriend(id);
      setMessage(
        isRequest
          ? `Request with @${handle} cancelled.`
          : `Removed @${handle} from your friends.`,
      );
      await refreshFriends();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update friendship.",
      );
    }
  }

  return (
    <div className="mt-8 border-t border-line/70 pt-8">
      <div>
        <h3 className="text-lg font-medium text-foreground">
          Friends &amp; Connections
        </h3>
        <p className="mt-1 text-xs text-muted">
          Connect with friends using their unique handle to view their
          friends-only cinema collections.
        </p>
      </div>

      <form onSubmit={handleSendRequest} className="mt-4">
        <label
          htmlFor="friend-handle-input"
          className="mb-2 block text-xs font-medium text-muted"
        >
          Add friend by handle
        </label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-lg border border-line bg-background px-3">
            <span className="text-sm font-semibold text-accent">@</span>
            <input
              id="friend-handle-input"
              type="text"
              pattern="^[a-zA-Z0-9_]{3,30}$"
              value={targetHandle}
              onChange={(e) => setTargetHandle(e.target.value)}
              placeholder="e.g. cinema_buff"
              required
              className="min-h-11 w-full bg-transparent px-2 text-sm text-foreground focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 rounded-lg bg-accent px-4 text-xs font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Sending…" : "Add friend"}
          </button>
        </div>
      </form>

      {message && (
        <p role="status" className="mt-3 text-xs font-medium text-emerald-400">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs font-medium text-rose-400">
          {error}
        </p>
      )}

      {data.incoming && data.incoming.length > 0 && (
        <div className="mt-6 rounded-xl border border-accent/40 bg-accent/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Incoming Friend Requests ({data.incoming.length})
          </p>
          <div className="mt-3 divide-y divide-line/60">
            {data.incoming.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div>
                  <span className="font-semibold text-foreground">
                    @{item.requester.handle}
                  </span>
                  {item.requester.displayName &&
                    item.requester.displayName !== item.requester.handle && (
                      <span className="ml-1 text-xs text-muted">
                        ({item.requester.displayName})
                      </span>
                    )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccept(item.id, item.requester.handle)}
                    className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-ink transition-opacity hover:opacity-90"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleRemove(item.id, item.requester.handle, true)
                    }
                    className="rounded-md border border-line px-3 py-1 text-xs text-muted hover:text-foreground"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.outgoing && data.outgoing.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-background/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Pending Sent Requests ({data.outgoing.length})
          </p>
          <div className="mt-3 divide-y divide-line/60">
            {data.outgoing.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div>
                  <span className="text-muted">@{item.recipient.handle}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleRemove(item.id, item.recipient.handle, true)
                  }
                  className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Your Friends ({data.friends ? data.friends.length : 0})
        </p>

        {loading ? (
          <p className="mt-3 text-xs text-muted">Loading friends…</p>
        ) : !data.friends || data.friends.length === 0 ? (
          <p className="mt-3 text-xs text-muted">
            No friends connected yet. Connect with other cinephiles using their
            handle above!
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.friends.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-line bg-background/50 p-3"
              >
                <div>
                  <span className="font-semibold text-accent">
                    @{item.friend.handle}
                  </span>
                  {item.friend.displayName &&
                    item.friend.displayName !== item.friend.handle && (
                      <span className="ml-1 text-xs text-muted">
                        ({item.friend.displayName})
                      </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveMatchFriend(item.friend)}
                    className="inline-flex items-center gap-1 rounded bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/25"
                  >
                    🎬 Watch Match
                  </button>
                  <a
                    href={`/cinema/${item.friend.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    View cinema ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id, item.friend.handle)}
                    className="text-xs text-muted hover:text-rose-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeMatchFriend && (
        <MovieNightMatchModal
          friend={activeMatchFriend}
          onClose={() => setActiveMatchFriend(null)}
        />
      )}
    </div>
  );
}

function MovieNightMatchModal({ friend, onClose }) {
  const { getMovieNightMatch, saveAccountMovie } = useCineTrack();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedIds, setSavedIds] = useState(new Set());
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function loadMatch() {
      try {
        const result = await getMovieNightMatch(friend.handle);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not compute Watch Match.",
          );
          setLoading(false);
        }
      }
    }

    loadMatch();
    return () => {
      cancelled = true;
    };
  }, [friend.handle, getMovieNightMatch]);

  async function handleSave(movie) {
    try {
      await saveAccountMovie({
        id: movie.tmdbId,
        title: movie.title,
        posterUrl: movie.posterUrl,
        releaseYear: movie.releaseYear,
        status: "saved",
      });
      setSavedIds((prev) => new Set([...prev, movie.tmdbId]));
    } catch {
      // Ignore save failure
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="watch-match-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <p className="eyebrow mb-1">
              <span aria-hidden="true" />
              COLLABORATIVE DISCOVERY
            </p>
            <h2
              id="watch-match-title"
              className="text-xl font-medium sm:text-2xl"
            >
              Movie Night Watch Match
            </h2>
            <p className="mt-1 text-xs text-accent">
              Matching your cinema with @{friend.handle}
              {friend.displayName && ` (${friend.displayName})`}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line p-2 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Close match dialog"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-muted">
              Blending your collections and calculating shared taste
              affinities…
            </p>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-lg border border-line px-4 py-2 text-xs text-foreground"
            >
              Close
            </button>
          </div>
        ) : data ? (
          <div className="mt-6 space-y-6">
            {data.commonGenres && data.commonGenres.length > 0 && (
              <div className="rounded-xl border border-line/70 bg-background/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Common Taste Signals
                </p>
                <p className="mt-1 text-xs text-muted">
                  Genres both of you watch and rate highly:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.commonGenres.map((genre) => (
                    <span
                      key={genre.id}
                      className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  Shared Watchlist Overlap
                </h3>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  {data.sharedWatchlist.length} Instant{" "}
                  {data.sharedWatchlist.length === 1 ? "Win" : "Wins"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Films both of you already saved to watch:
              </p>

              {data.sharedWatchlist.length === 0 ? (
                <p className="mt-3 rounded-lg border border-line/40 bg-background/30 p-3 text-xs text-muted">
                  No overlapping saved movies yet. Check out fresh shared picks
                  below!
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data.sharedWatchlist.map((movie) => (
                    <div
                      key={movie.tmdbId}
                      className="flex flex-col rounded-lg border border-line bg-background/50 p-2.5 text-xs"
                    >
                      {movie.posterUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={movie.posterUrl}
                          alt={movie.title}
                          className="aspect-[2/3] w-full rounded object-cover"
                          loading="lazy"
                        />
                      )}
                      <p className="mt-2 font-medium line-clamp-1">
                        {movie.title}
                      </p>
                      <p className="text-muted">
                        {movie.releaseYear || "Movie"}
                      </p>
                      <span className="mt-1 inline-block text-[10px] text-emerald-400">
                        ✓ On both watchlists
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Fresh Picks For Tonight
              </h3>
              <p className="mt-1 text-xs text-muted">
                Unseen movies matching your shared genres:
              </p>

              {data.recommendations.length === 0 ? (
                <p className="mt-3 rounded-lg border border-line/40 bg-background/30 p-3 text-xs text-muted">
                  No new shared recommendations right now.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data.recommendations.map((movie) => {
                    const isSaved = savedIds.has(movie.tmdbId);
                    return (
                      <div
                        key={movie.tmdbId}
                        className="flex flex-col justify-between rounded-lg border border-line bg-background/50 p-2.5 text-xs"
                      >
                        <div>
                          {movie.posterUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={movie.posterUrl}
                              alt={movie.title}
                              className="aspect-[2/3] w-full rounded object-cover"
                              loading="lazy"
                            />
                          )}
                          <p className="mt-2 font-medium line-clamp-1">
                            {movie.title}
                          </p>
                          <p className="text-muted">
                            {movie.releaseYear || "Movie"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isSaved}
                          onClick={() => handleSave(movie)}
                          className="mt-3 w-full rounded bg-accent/15 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
                        >
                          {isSaved ? "Saved ✓" : "+ Add to My Cinema"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
