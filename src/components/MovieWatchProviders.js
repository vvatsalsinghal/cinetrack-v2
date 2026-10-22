import Image from "next/image";
import {
  CineTrackApiError,
  getApiMovieWatchProviders,
} from "@/lib/cinetrackApi";

const categoryLabels = {
  flatrate: "Stream",
  free: "Free",
  ads: "With ads",
  rent: "Rent",
  buy: "Buy",
};

function ProviderList({ title, providers }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      <ul className="mt-3 flex flex-wrap gap-3">
        {providers.map((provider) => (
          <li
            key={provider.id}
            className="flex min-h-12 items-center gap-2 rounded-lg border border-line bg-background/60 px-3 py-2 text-sm"
          >
            {provider.logoUrl && (
              <Image
                src={provider.logoUrl}
                alt=""
                width={28}
                height={28}
                className="rounded-md"
              />
            )}
            <span>{provider.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function MovieWatchProviders({ movieId }) {
  let availability;

  try {
    availability = await getApiMovieWatchProviders(movieId);
  } catch (error) {
    if (!(error instanceof CineTrackApiError)) {
      throw error;
    }

    return (
      <section
        aria-labelledby={`watch-providers-${movieId}`}
        className="mt-10 border-t border-line pt-6"
      >
        <h2
          id={`watch-providers-${movieId}`}
          className="text-lg font-medium"
        >
          Where to watch in India
        </h2>
        <p role="alert" className="mt-3 text-sm leading-6 text-muted">
          {error.message}
        </p>
      </section>
    );
  }

  const providerGroups = Object.entries(availability.providersByCategory);
  const hasProviders = providerGroups.length > 0;

  return (
    <section
      aria-labelledby={`watch-providers-${movieId}`}
      className="mt-10 border-t border-line pt-6"
    >
      <h2 id={`watch-providers-${movieId}`} className="text-lg font-medium">
        Where to watch in India
      </h2>
      {hasProviders ? (
        <div className="mt-5 space-y-5">
          {providerGroups.map(([category, providers]) => (
            <ProviderList
              key={category}
              title={categoryLabels[category]}
              providers={providers}
            />
          ))}
          {availability.link && (
            <a
              href={availability.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center text-sm text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              View streaming availability ↗
            </a>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">
          TMDB currently lists no streaming options in India for this movie.
        </p>
      )}
      <p className="mt-4 text-xs leading-5 text-muted">
        Availability provided by TMDB and JustWatch; providers and options may
        change.
      </p>
    </section>
  );
}
