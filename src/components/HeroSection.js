import CinemaGlobe from "@/components/CinemaGlobe";

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5"
    >
      <path
        d="M4.167 10h11.666M10 4.167 15.833 10 10 15.833"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HeroSection() {
  return (
    <section
      id="top"
      className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-28 lg:pt-16"
    >
      <div className="relative z-10 max-w-2xl">
        <p className="eyebrow mb-7">
          <span aria-hidden="true" />
          YOUR PERSONAL CINEMA COMPANION · INDIA &amp; WORLD CINEMA
        </p>
        <h1 className="hero-title">
          Make movie night
          <br />
          <span>feel like yours.</span>
        </h1>
        <p className="mt-7 max-w-lg text-base leading-8 text-muted sm:text-lg">
          Discover stories for the moment, keep track of what you watch, and
          make every choice a little more personal.
        </p>
        <a
          href="#the-cinetrack-way"
          className="mt-10 inline-flex items-center gap-3 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Meet your cinema
          <ArrowIcon />
        </a>
        <p className="mt-5 text-xs tracking-wide text-muted">
          A thoughtful home for Indian cinema and great stories from around the world.
        </p>
      </div>

      <div className="relative mx-auto flex w-full max-w-[500px] justify-center">
        <CinemaGlobe />
      </div>
    </section>
  );
}
