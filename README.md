This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## TMDB setup

The popular-movies shelf uses the TMDB API from a server-rendered component.
Successful results are cached on the server for one hour, so a brief TMDB or
network interruption does not require every page view to make a fresh API
request. If TMDB is unreachable before a result is cached or refreshed, the
shelf shows an error instead of invented data.

To configure it locally:

1. Copy `.env.example` to `.env.local`.
2. Replace the placeholder with your TMDB API Read Access Token.
3. Restart the development server after changing the environment file.

Keep the token in `TMDB_READ_ACCESS_TOKEN`. Do not rename it with a
`NEXT_PUBLIC_` prefix or commit `.env.local`. The local environment file is
ignored by Git; `.env.example` contains only a placeholder and can be shared.

TMDB movie cards load official trailer, rating, and genre details only when
previewed. Hover a card on desktop, or use its Preview button on touch devices.
Trailer clips play muted for up to 12 seconds; a preview is not shown when TMDB
does not list an official YouTube trailer.
Movie detail pages show India streaming options reported by TMDB, with a
TMDB-supplied availability link when available.
Visit Discover to browse up to 12 unique TMDB movies per page. Its mood
shortcuts map to TMDB genres, and runtime filters use TMDB movie runtime
metadata verified against each movie's details; neither is a personalized
recommendation. The homepage also provides a quick form that links to the same
filtered discovery results.

## Express API

The separate Express API exposes a health check at
`http://localhost:4000/api/health`, movie search at
`http://localhost:4000/api/movies/search?q=Arrival`, popular movies at
`http://localhost:4000/api/movies/popular`, and movie details at
`http://localhost:4000/api/movies/329865`. India streaming providers are
available at `http://localhost:4000/api/movies/329865/watch-providers`.
Paginated discovery, including the current mood and runtime filters, is
available at `http://localhost:4000/api/movies/discover?page=1&mood=feel-good&runtime=90`.
Start the API in a second terminal with `npm run dev:api`, and run its
automated tests with `npm run test:api`. It reads the existing root
`.env.local` for the server-only TMDB token. The Next.js movie-search page and
homepage popular-movie shelf call this API from the browser. Movie detail
pages request details, trailer metadata, and India streaming availability
from Express on the Next.js server. Card hover previews request the same movie
metadata through Next.js, which then calls Express. Discover also requests its
paginated movie results and optional mood/runtime filters from Express. Set
`CINETRACK_API_URL` to the API's server-side URL when the frontend and API are
deployed separately.

The API allows the local website origin by default; set
`CINETRACK_FRONTEND_ORIGIN` in `.env.local` if the frontend uses another
origin. `NEXT_PUBLIC_CINETRACK_API_URL` configures browser requests, while
`CINETRACK_API_URL` configures server-to-server requests.

## Stage 08 accounts and persistence

The Express API uses MongoDB for CineTrack accounts, sessions, and each user's
private My Cinema collection. Add the local MongoDB connection string as
`MONGODB_URI` in the ignored `.env.local` file, then verify it with
`npm run check:db`. Start MongoDB, the API (`npm run dev:api`), and Next.js
(`npm run dev`) in separate terminals.

Create an account or sign in at `/account`. Passwords must be at least 12
characters and no more than 72 UTF-8 bytes. The API stores bcrypt password
hashes, and the browser receives an HTTP-only, SameSite=Lax session cookie;
production cookies are Secure. My Cinema saves, status changes, ratings, notes,
and removals are user-scoped in MongoDB after sign-in.

Existing browser-local My Cinema entries are imported after successful
sign-in. Account entries already present are preserved, and browser storage is
cleared only after a successful import. Signed-out collection activity remains
in that browser. The API integration tests use a uniquely named temporary
database and remove it after the tests. Email verification and password-reset
flows are not included yet.

## Stage 09 activity-based recommendations

The signed-in homepage requests private recommendations from the authenticated
Express API. CineTrack considers up to 20 of the most recently updated movies
marked “Watching” or “Finished”, plus any movie rated 4 or 5 stars. “Finished”
adds a stronger signal than “Watching”; a 4-star rating adds one point and a
5-star rating adds two. It reads real genre IDs and names from TMDB movie
details, ranks the top three genres, and asks TMDB for popular movies in those
genres. Every title already in the user's My Cinema collection is excluded.

This is a small, explainable genre-matching rule, not an AI model or a claim
about a user's taste. The recommendation API response is private and not
cached. Signed-out users see a sign-in prompt; signed-in users with no
qualifying activity are asked to mark a film Watching/Finished or rate it
4–5 stars. Recommendations currently cover TMDB movies, not TV series.

## Stage 10 regional cinema news (Cinema Pulse)

Cinema Pulse aggregates film journalism, festival reports, and industry
announcements tailored by region and language using curated server-side RSS
feeds with zero paid services or API keys required. Sources include Variety and
Deadline for Global/Hollywood (English), plus The Hindu, The Indian Express,
BBC News Hindi, and Cinema Express (Tamil and Telugu) for Indian cinema.

The Express API exposes `http://localhost:4000/api/news` with query validation:
- `region`: `all` (default), `india`, `global`
- `language`: `all` (default), `en`, `hi`, `ta`, `te`
- `limit`: `1` to `50` (default 20)

Feed responses are cached in memory for 15 minutes to reduce external network
traffic, with fallback dispatches to ensure reliable delivery even if upstream
feeds are temporarily unreachable. The dedicated `/news` page offers interactive
region and language filter pills, responsive card layouts, and UTC publication dates,
while a highlights shelf on the homepage previews the latest top stories.

## Stage 11 friends, sharing controls, and collaborative discovery (Movie Night Watch Match)

Stage 11 introduces privacy-centric social connections and collaborative discovery:
- **Handles & Privacy Controls**: Accounts are identified by a unique sparse `@handle` (3–30 alphanumeric/underscore characters) and display name. Collections can be set to `private` (default), `friends` (accessible only by accepted friends), or `public` (accessible via shareable URL `/cinema/[handle]`). Private emails and personal notes are never exposed.
- **Dedicated Curator Pages**: `/cinema/[handle]` provides a clean, responsive view of any public or friend-scoped collection with status filters and personal star ratings, with session-aware cookie verification in Next.js Server Components.
- **Friends Manager**: The `/account` dashboard enables searching users by handle, sending friend requests, accepting incoming invites, and managing connections.
- **Movie Night Watch Match**: Connected friends can run a collaborative watch match (`GET /api/me/match/:friendHandle`). It computes:
  1. **Shared Watchlist Overlap (Instant Wins)**: Movies both users have saved to watch.
  2. **Common Taste Signals**: Top overlapping favorite genres blended from both users' viewing activity and 4–5 star ratings.
  3. **Fresh Shared Recommendations**: TMDB picks tailored to overlapping genres, automatically excluding anything already in either friend's collection, with one-click "+ Add to My Cinema" buttons.

## Stage 12 security, accessibility, and production readiness

Stage 12 hardens CineTrack for production use across security, accessibility, and automated test reliability:
- **Security & Rate Limiting**:
  - Sliding-window in-memory rate limiter attached to sensitive auth routes (`POST /api/auth/login` and `POST /api/auth/register`), preventing brute-force and credential stuffing attacks (10 attempts per 15-minute window per IP) while returning standard RFC-compliant `RateLimit-*` and `Retry-After` headers on HTTP 429.
  - Uniform HTTP security headers across both the Express API and Next.js frontend (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
  - Strict isolation: TMDB API tokens and MongoDB credentials remain strictly server-side.
- **Accessibility & Keyboard Navigation**:
  - Top-level "Skip to main content" link across all page layouts with target `id="main-content"` anchors on every route for screen-reader and keyboard-only navigation.
  - Full keyboard control on modal dialogs (`MovieNightMatchModal`): automatic focus management on mount, `role="dialog"`, `aria-modal="true"`, and instant <kbd>Escape</kbd> key dismissal.
  - Interactive movie cards (`MovieCard`) support <kbd>Escape</kbd> key dismissal of trailer preview overlays.
- **Testing & Verification**:
  - 49 automated integration and unit tests across 12 test suites verifying auth rate limiting, security headers, RSS feed XML/CDATA parsing, TMDB proxy services, database indexes, and friend permissions.
  - Zero-error Next.js production builds and ESLint compliance across all 10 routes.

## My Cinema storage

My Cinema is one collection with “Saved for later”, “Watching”, and “Finished”
statuses. Optional 1–5 personal ratings and private notes (up to 500
characters) belong to each entry. Signed-out entries are stored in this
browser; signed-in entries are stored in the user's MongoDB-backed account.

## Project progress

- [x] Stage 00 — Environment, project planning and setup
- [x] Stage 01 — Next.js foundation, initial homepage and design system
- [x] Stage 02 — Reusable movie cards, layouts, components and mock data
- [x] Stage 03 — TMDB integration, discovery, search, movie details and error handling
  - [x] Server-rendered popular movies with poster images
  - [x] Server-rendered movie search with loading, error and no-results states
  - [x] Server-rendered movie details linked from TMDB movie cards
  - [x] Dedicated paginated popular-movie discovery page
- [x] Stage 04 — Unified My Cinema collection
  - [x] Save for later from a movie detail page with browser-local persistence
  - [x] Browse and remove saved movies from the My Cinema page
  - [x] Change and filter collection statuses: Saved for later, Watching, Finished
  - [x] Add optional personal ratings and private notes to collection entries
- [x] Stage 05 — Trailer interactions and streaming availability
  - [x] Show an on-demand official YouTube trailer on movie details and hover previews on TMDB cards when available
  - [x] Show TMDB-reported streaming options and availability link for India when available
- [x] Stage 06 — Mood- and time-based discovery
  - [x] Add explainable genre-based mood shortcuts and runtime limits to Discover
  - [x] Add a homepage quick-pick for the existing mood and runtime filters
- [x] Stage 07 — Express backend and REST API
  - [x] Create a separate Express API with a tested health endpoint
  - [x] Add validated TMDB movie search with a server-side token
  - [x] Connect the Next.js search page to the Express API
  - [x] Add a popular-movies API endpoint and connect the homepage shelf
  - [x] Add movie details and official trailer metadata to Express; connect detail pages
  - [x] Add India streaming-provider endpoint and connect movie detail pages
  - [x] Add paginated discovery and mood/runtime filters to Express; connect Discover
  - [x] Route movie-card trailer preview metadata through Express
- [x] Stage 08 — MongoDB persistence, user accounts and authentication
  - [x] Add the Mongoose connection helper and user/collection schemas for local MongoDB
  - [x] Add email/password registration, sign-in, sign-out, and HTTP-only sessions
  - [x] Add user-scoped My Cinema persistence and browser-data import
  - [x] Connect account and collection UI while preserving signed-out local storage
  - [x] Verify API authentication, collection isolation, lint, build, and database connectivity
- [x] Stage 09 — Activity-based recommendations
  - [x] Derive a bounded, explainable genre profile from private collection activity
  - [x] Request real TMDB recommendations and exclude movies already in My Cinema
  - [x] Add homepage signed-out, loading, empty, error, and personalized states
- [x] Stage 10 — Regional cinema news (Cinema Pulse)
  - [x] Configure server-side RSS feeds for Global (Variety, Deadline) and Indian cinema (The Hindu, Indian Express, BBC Hindi, Cinema Express)
  - [x] Add Express endpoint GET /api/news with region, language, and limit query filtering and in-memory TTL caching
  - [x] Add dedicated Next.js Cinema Pulse page (/news) with responsive cards, filter chips, and loading/empty/error states
  - [x] Add homepage Cinema Pulse preview shelf and top-navigation link
  - [x] Verify feed parsing, unique sha256 article hashing, API query validation, lint, build, and tests
- [x] Stage 11 — Friends, sharing controls, and collaborative discovery
  - [x] Unique sparse @handle and collection privacy settings (private, friends, public)
  - [x] Shareable public and friend-scoped collection route at /cinema/[handle]
  - [x] Friend request management (search, request, accept, decline, remove) in AccountPanel
  - [x] Collaborative Movie Night Watch Match blending shared watchlists, top mutual genres, and fresh TMDB picks
- [x] Stage 12 — Testing, accessibility, security, deployment and documentation
  - [x] Sliding window auth rate limiting and uniform HTTP security headers (API & Next.js)
  - [x] Accessible skip-to-content links, ARIA modal focus management, and keyboard Escape key listeners
  - [x] Complete automated test coverage (49 tests), build verification, and deployment documentation

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.js`. The page
auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
