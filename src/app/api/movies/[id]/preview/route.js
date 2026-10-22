import {
  CineTrackApiError,
  getApiMovieDetails,
} from "@/lib/cinetrackApi";

export async function GET(_request, { params }) {
  const { id } = await params;

  try {
    const movie = await getApiMovieDetails(id);

    return Response.json({
      voteAverage: movie.voteAverage,
      genres: movie.genres,
      trailerKey: movie.trailerKey,
    });
  } catch (error) {
    if (!(error instanceof CineTrackApiError)) {
      throw error;
    }

    const status = error.status === 404 ? 404 : 502;
    return Response.json({ error: error.message }, { status });
  }
}
