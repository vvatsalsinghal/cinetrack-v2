import HeroSection from "@/components/HeroSection";
import HomeDiscoveryForm from "@/components/HomeDiscoveryForm";
import MovieSearchForm from "@/components/MovieSearchForm";
import PopularMovieSection from "@/components/PopularMovieSection";
import PersonalizedRecommendations from "@/components/PersonalizedRecommendations";
import HomeCinemaPulse from "@/components/HomeCinemaPulse";
import SectionHeading from "@/components/SectionHeading";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ValueHighlights from "@/components/ValueHighlights";

export default function Home() {
  return (
    <main id="main-content" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="cinema-grid pointer-events-none" />

      <SiteHeader />

      <HeroSection />

      <section
        aria-label="Search movies"
        className="border-t border-line bg-surface/50"
      >
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <MovieSearchForm />
        </div>
      </section>

      <HomeDiscoveryForm />

      <PopularMovieSection />

      <PersonalizedRecommendations />

      <HomeCinemaPulse />

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

      <SiteFooter />
    </main>
  );
}
