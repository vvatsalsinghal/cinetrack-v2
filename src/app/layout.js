/**
 * ==============================================================================
 * ROOT LAYOUT (NEXT.JS APP ROUTER)
 * ==============================================================================
 * 
 * WHAT THIS FILE DOES:
 * Defines the top-level HTML skeleton (`<html>` and `<body>`) that wraps EVERY page
 * in the CineTrack application.
 * 
 * CORE ARCHITECTURAL CONCEPTS DEMONSTRATED HERE:
 * 1. Persistent Context Layer (<CineTrackProvider>):
 *    Wraps the whole application so that authentication state, user profile,
 *    and saved movie collections persist across client-side page navigations.
 * 
 * 2. Global Sticky Header Placement (<SiteHeader />):
 *    Placing `<SiteHeader />` here at the root level (outside of individual page `<main>`
 *    tags) ensures that the navbar remains permanently visible and sticky on all routes,
 *    including movie details (`/movie/[id]`), search (`/search`), and account settings.
 * 
 * 3. Accessibility "Skip to Main Content" Link:
 *    Allows keyboard and screen-reader users to skip the header navigation and jump
 *    straight to `#main-content` (WCAG 2.1 accessibility best practice).
 * 
 * 4. Ambient Background & AI Chatbot:
 *    - `<CinemaAmbientBackground />`: Renders subtle glowing canvas ambient particles.
 *    - `<CinemaChatbot />`: Floats the CineTrack AI assistant button on every screen.
 * ==============================================================================
 */

import "./globals.css";
import { CineTrackProvider } from "@/components/CineTrackProvider";
import CinemaChatbot from "@/components/CinemaChatbot";
import CinemaAmbientBackground from "@/components/CinemaAmbientBackground";
import SiteHeader from "@/components/SiteHeader";

// Next.js SEO & Open Graph Metadata
export const metadata = {
  title: "CineTrack — Your personal cinema companion",
  description:
    "Discover stories for the moment and make every movie night feel more personal with CineTrack.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Accessible skip link for keyboard/screen-reader navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>

        {/* Global application context & persistent UI components */}
        <CineTrackProvider>
          <CinemaAmbientBackground />
          <SiteHeader />
          {children}
          <CinemaChatbot />
        </CineTrackProvider>
      </body>
    </html>
  );
}
