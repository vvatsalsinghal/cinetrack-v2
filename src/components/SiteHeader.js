"use client";

import Link from "next/link";
import { useCineTrack } from "@/components/CineTrackProvider";

export default function SiteHeader() {
  const { authStatus } = useCineTrack();

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
      <Link
        href="/"
        aria-label="CineTrack home"
        className="flex items-center gap-3"
      >
        <span aria-hidden="true" className="brand-mark">
          <span />
          <span />
          <span />
        </span>
        <span className="text-xl font-semibold tracking-tight">
          Cine<span className="text-accent">Track</span>
        </span>
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-5 sm:gap-8">
        <p className="hidden text-xs font-medium tracking-[0.18em] text-muted sm:block">
          A LITTLE MORE YOU, IN EVERY WATCH
        </p>
        <Link
          href="/discover"
          className="text-sm font-medium text-foreground transition-colors hover:text-accent"
        >
          Discover
        </Link>
        <Link
          href="/news"
          className="text-sm font-medium text-foreground transition-colors hover:text-accent"
        >
          Cinema Pulse
        </Link>
        <Link
          href="/my-cinema"
          className="text-sm font-medium text-foreground transition-colors hover:text-accent"
        >
          My Cinema
        </Link>
        <Link
          href="/account"
          className="text-sm font-medium text-foreground transition-colors hover:text-accent"
        >
          {authStatus === "authenticated" ? "Account" : "Sign in"}
        </Link>
      </nav>
    </header>
  );
}
