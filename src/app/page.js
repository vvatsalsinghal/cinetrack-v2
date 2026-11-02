/**
 * ==============================================================================
 * HOMEPAGE ENTRY POINT (SERVER COMPONENT)
 * ==============================================================================
 * 
 * WHAT THIS PAGE DOES:
 * Serves as the landing page (`/`) for CineTrack, showcasing the Hero section,
 * quick search bar, mood discovery tool, trending movie shelves, personalized
 * recommendations, and the live Cinema Pulse RSS news feed.
 * 
 * CORE ARCHITECTURAL CONCEPTS DEMONSTRATED HERE:
 * 1. React Server Component (RSC) by Default:
 *    Because this file does NOT have `"use client"`, it is executed on the server.
 *    It produces minimal JavaScript bundle overhead and sends pure HTML to the browser.
 * 
 * 2. Component Composition Architecture:
 *    Instead of one massive 1000-line file, the homepage is cleanly composed of
 *    specialized, decoupled components, each owning its own styling and functionality:
 *    - <HeroSection />: 3D interactive Cinema Globe + elevator pitch
 *    - <MovieSearchForm />: Instant search bar routing to /search
 *    - <HomeDiscoveryForm />: Mood & emotion-based recommendation engine
 *    - <PopularMovieSection />: Tabbed popular movies (Indian / Trending / Global)
 *    - <PersonalizedRecommendations />: Smart picks based on saved cinema
 *    - <HomeCinemaPulse />: Live film news from BBC, Variety, etc.
 * 
 * 3. Semantic Landmark Structure:
 *    Uses `<main id="main-content">` matching the skip link in `layout.js` for full
 *    accessibility compliance.
 * ==============================================================================
 */

import HeroSection from "@/components/HeroSection";
import HomeDiscoveryForm from "@/components/HomeDiscoveryForm";
import MovieSearchForm from "@/components/MovieSearchForm";
import PopularMovieSection from "@/components/PopularMovieSection";
import PersonalizedRecommendations from "@/components/PersonalizedRecommendations";
import HomeCinemaPulse from "@/components/HomeCinemaPulse";
import SectionHeading from "@/components/SectionHeading";
import SiteFooter from "@/components/SiteFooter";
import ValueHighlights from "@/components/ValueHighlights";

export default function Home() {
  return (
    <main id="main-content" className="relative isolate overflow-hidden">
      {/* Decorative neon grid lines */}
      <div aria-hidden="true" className="cinema-grid pointer-events-none" />

      {/* 1. Hero Section: Headline & 3D Interactive Cinema Globe */}
      <HeroSection />

      {/* 2. Fast TMDB Movie Search Bar */}
      <section
        aria-label="Search movies"
        className="border-t border-line bg-surface/50"
      >
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <MovieSearchForm />
        </div>
      </section>

      {/* 3. Mood & Emotion Discovery Engine */}
      <HomeDiscoveryForm />

      {/* 4. Curated Popular Movie Shelves (Indian, Trending, Global) */}
      <PopularMovieSection />

      {/* 5. Personalized Recommendations for User Library */}
      <PersonalizedRecommendations />

      {/* 6. Live Cinema Pulse Film News (BBC, Variety, Hollywood Reporter) */}
      <HomeCinemaPulse />

      {/* 7. CineTrack Values & Mission Statement */}
      <section
        id="the-cinetrack-way"
        className="relative border-t border-line bg-surface/70"
      >
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="LESS SEARCHING, MORE WATCHING"
              title="Your cinema, your way."
            />
            <p className="max-w-sm text-sm leading-7 text-muted">
              A good story deserves more than a fleeting spot in your
              recommendations.
            </p>
          </div>
          <ValueHighlights />
        </div>
      </section>

      {/* 8. Global Site Footer */}
      <SiteFooter />
    </main>
  );
}
