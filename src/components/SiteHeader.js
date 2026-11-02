"use client";

/**
 * ==============================================================================
 * SITE HEADER & NAVIGATION (CLIENT COMPONENT)
 * ==============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * Provides the global sticky top navigation bar across all CineTrack pages.
 * - On desktop: Displays direct links (Discover, Cinema Pulse, My Cinema) + Account pill.
 * - On mobile: Displays a 3-line hamburger menu that opens a frosted slide-out drawer.
 * 
 * CORE ARCHITECTURAL CONCEPTS DEMONSTRATED HERE:
 * 1. Global Persistence in RootLayout:
 *    Mounted directly in `src/app/layout.js` inside `<CineTrackProvider>`.
 *    Because it sits directly under `<body>` (outside of `<main overflow-hidden>`),
 *    `position: sticky` works smoothly across all pages during scroll.
 * 
 * 2. Mobile Drawer & Body Scroll Locking:
 *    When `mobileMenuOpen` is true, the `useEffect` sets `document.body.style.overflow = "hidden"`
 *    to prevent the underlying page from scrolling while the menu is open.
 *    The effect's cleanup function restores `overflow = ""` when closed or unmounted.
 * 
 * 3. Keyboard & Screen Reader Accessibility:
 *    - Listens for the `Escape` key to close the mobile menu immediately.
 *    - Uses `aria-label`, `aria-expanded`, and semantic `<nav>`, `<header>` elements.
 * 
 * 4. Next.js 16 Static Prerendering Compliance:
 *    Avoids calling runtime `usePathname()` directly outside of a `<Suspense>` boundary,
 *    guaranteeing that Next.js 16 static site generation (SSG) compiles without errors.
 * ==============================================================================
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCineTrack } from "@/components/CineTrackProvider";

export default function SiteHeader() {
  // Read authenticated user info and login status from CineTrack context
  const { user, authStatus } = useCineTrack();

  // Mobile drawer open/close toggle state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * Body Scroll Lock & Accessibility Effect:
   * Prevents background page scrolling while the drawer is open.
   * Also binds an 'Escape' key listener for desktop/keyboard accessibility.
   */
  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }

    // Freeze background scrolling
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup: restore scroll and remove event listener
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  // Primary site navigation destinations
  const navLinks = [
    { href: "/discover", label: "Discover" },
    { href: "/news", label: "Cinema Pulse" },
    { href: "/my-cinema", label: "My Cinema" },
  ];

  const isAuthenticated = authStatus === "authenticated";

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-line/50 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 lg:px-10">
          {/* Brand Logo with Cinema Film Reel Icon */}
          <Link
            href="/"
            aria-label="CineTrack home"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/40 bg-accent/15 text-accent shadow-sm"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4" />
              </svg>
            </span>
            <span className="text-xl font-semibold tracking-tight">
              Cine<span className="text-accent">Track</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-foreground/85 transition-colors hover:text-accent"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/account"
              className="flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-accent hover:text-accent"
            >
              {isAuthenticated && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {isAuthenticated ? (user?.handle ? `@${user.handle}` : "Account") : "Sign in"}
            </Link>
          </nav>

          {/* Mobile Right Controls: Sign in pill + Hamburger Button */}
          <div className="flex items-center gap-2.5 md:hidden">
            <Link
              href="/account"
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-foreground hover:border-accent"
            >
              {isAuthenticated && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
              {isAuthenticated ? "Account" : "Sign in"}
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface/80 text-foreground transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                {mobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="17" x2="20" y2="17" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sliding Drawer & Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end md:hidden">
          {/* Backdrop overlay */}
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
            className="relative z-10 flex h-full w-[290px] flex-col justify-between border-l border-line bg-surface p-6 shadow-2xl animate-in slide-in-from-right duration-250"
          >
            <div>
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between border-b border-line pb-4">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/40 bg-accent/15 text-accent shadow-sm"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4" />
                    </svg>
                  </span>
                  <span className="font-semibold tracking-tight text-foreground">
                    Cine<span className="text-accent">Track</span>
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-lg border border-line p-1.5 text-muted hover:border-accent hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="mt-6 flex flex-col gap-2">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-elevated hover:text-accent"
                >
                  <span>🏠 Home</span>
                </Link>

                <Link
                  href="/discover"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-elevated hover:text-accent"
                >
                  <span>🎬 Discover</span>
                  <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                    Moods
                  </span>
                </Link>

                <Link
                  href="/news"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-elevated hover:text-accent"
                >
                  <span>⚡ Cinema Pulse</span>
                  <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                    News
                  </span>
                </Link>

                <Link
                  href="/my-cinema"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-elevated hover:text-accent"
                >
                  <span>🍿 My Cinema</span>
                  <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                    Watchlist
                  </span>
                </Link>

                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-elevated hover:text-accent"
                >
                  <span>👤 {isAuthenticated ? "Account & Friends" : "Sign In / Register"}</span>
                  {isAuthenticated && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  )}
                </Link>
              </nav>
            </div>

            {/* Bottom Status Card */}
            <div className="border-t border-line pt-4">
              {isAuthenticated ? (
                <div className="rounded-xl border border-line bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted">Signed In As</p>
                  <p className="truncate text-xs font-semibold text-accent mt-0.5">
                    {user?.email}
                  </p>
                  {user?.handle && (
                    <p className="text-[11px] text-muted">@{user.handle}</p>
                  )}
                </div>
              ) : (
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-xl bg-accent py-2.5 text-xs font-semibold text-ink transition-opacity hover:opacity-90"
                >
                  Sign in to Sync Cinema
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
