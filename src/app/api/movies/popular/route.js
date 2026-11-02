const TMDB_IMAGE_URL =
  /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;
const POSTER_PATH = /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

const FALLBACK_TMDB_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyYjQzNDYzMGZlYWZhNWUwODYyZDQ1MGQ1NTFkNTZkOCIsIm5iZiI6MTc5MjIzMzI5OS4yMDgsInN1YiI6IjZhZDM0ZjUzNWM2ZGI5NzY4ZGM2NDAzZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4iwcXmkGH1ytVBP3NzXBr90FjCiE7k0YkfBYP_lf14s";

function sanitizeToken(raw) {
  if (!raw || typeof raw !== "string") return "";
  let token = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }
  return token;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Math.min(500, parseInt(searchParams.get("page") || "1", 10) || 1));
  const industry = (searchParams.get("industry") || "").trim().toLowerCase();
  const region = (searchParams.get("region") || "").trim().toUpperCase();

  const rawEnvToken = process.env.TMDB_READ_ACCESS_TOKEN;
  let token = sanitizeToken(rawEnvToken) || FALLBACK_TMDB_TOKEN;

  // Determine TMDB endpoint
  // When industry is indian or region is IN, query Indian cinema specifically (with_origin_country=IN)
  // because TMDB's /movie/popular?region=IN only filters release dates and returns foreign/Hollywood movies.
  let tmdbPath = `/movie/popular?language=en-US&page=${page}`;

  if (industry === "indian" || industry === "in" || region === "IN") {
    tmdbPath = `/discover/movie?include_adult=false&language=en-US&page=${page}&sort_by=popularity.desc&with_origin_country=IN`;
  } else if (region) {
    tmdbPath = `/movie/popular?language=en-US&page=${page}&region=${encodeURIComponent(region)}`;
  }

  const makeTmdbFetch = (activeToken) => {
    // If the token is a 32-character v3 API key, append it as a query parameter
    if (activeToken.length === 32 && /^[a-f0-9]{32}$/i.test(activeToken)) {
      const separator = tmdbPath.includes("?") ? "&" : "?";
      return fetch(`https://api.themoviedb.org/3${tmdbPath}${separator}api_key=${activeToken}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
      });
    }

    // Otherwise use v4 Read Access Token with Bearer auth
    return fetch(`https://api.themoviedb.org/3${tmdbPath}`, {
      headers: {
        Authorization: `Bearer ${activeToken}`,
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });
  };

  try {
    let tmdbRes = await makeTmdbFetch(token);

    // If the environment token returned 401 Unauthorized (e.g. misconfigured in Vercel),
    // retry automatically with the verified project fallback token.
    if (tmdbRes.status === 401 && token !== FALLBACK_TMDB_TOKEN) {
      console.warn("Primary TMDB token returned 401; falling back to verified token.");
      token = FALLBACK_TMDB_TOKEN;
      tmdbRes = await makeTmdbFetch(token);
    }

    if (!tmdbRes.ok) {
      return Response.json(
        { error: `TMDB returned HTTP ${tmdbRes.status}` },
        { status: 502 },
      );
    }

    const payload = await tmdbRes.json();

    if (!Array.isArray(payload.results)) {
      return Response.json(
        { error: "TMDB returned an unexpected response format." },
        { status: 502 },
      );
    }

    const results = payload.results.map((movie) => {
      const releaseDate =
        typeof movie.release_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(movie.release_date)
          ? movie.release_date
          : null;

      const posterUrl =
        typeof movie.poster_path === "string" &&
        POSTER_PATH.test(movie.poster_path)
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null;

      return {
        id: movie.id,
        title: typeof movie.title === "string" ? movie.title.trim() : "Untitled",
        releaseYear: releaseDate ? releaseDate.slice(0, 4) : null,
        posterUrl,
      };
    });

    return Response.json(
      {
        page: payload.page || page,
        totalPages: Math.min(payload.total_pages || 1, 500),
        totalResults: payload.total_results || 0,
        results,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("TMDB fetch error:", error);
    return Response.json(
      { error: "Could not fetch popular movies from TMDB." },
      { status: 502 },
    );
  }
}

