import Image from "next/image";

export default function SiteFooter() {
  return (
    <footer className="relative mx-auto flex max-w-7xl flex-col gap-4 px-6 py-7 text-xs text-muted sm:flex-row sm:items-start sm:justify-between lg:px-10">
      <div>
        <p className="font-semibold tracking-wide text-foreground">CineTrack</p>
        <p className="mt-2">MADE FOR THE WAY YOU WATCH.</p>
      </div>
      <details className="max-w-md">
        <summary className="cursor-pointer font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          Credits
        </summary>
        <div className="mt-3 flex items-center gap-3">
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
            aria-label="The Movie Database (TMDB)"
          >
            <Image
              src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
              alt="TMDB logo"
              width={36}
              height={36}
              className="shrink-0"
              style={{ width: "36px", height: "36px" }}
              unoptimized
            />
          </a>
          <p>
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </p>
        </div>
      </details>
    </footer>
  );
}
