# ESPN Pick'em Confidence Pool Dashboard

A read-only analytics dashboard for an ESPN NFL Pick'em **confidence** pool. It
visualises how the group distributes confidence against the national pool, adds
market/model context, and answers "what if this game had gone the other way?"

Everything is derived from ESPN's public APIs. There is no database, no login,
and nothing is written back to ESPN.

## What it shows

A mobile-first app with four tabs. The first visit asks "which one is you?" and
highlights your entry everywhere after that (saved on the device only).

**Standings** (`/`)
- Your place, season total, and how far behind first you are.
- A ring showing this week's points: scored, still possible, and lost. The
  "max" is the whole-week best case, matching ESPN's `possiblePointsMax`, not
  just the games played so far.
- The leaderboard, by season or by week, with the same scored/possible/lost bar
  for everyone.

**Games** (`/games`)
- One card per game: logos, score or kickoff time, and who picked each side.
- Your pick is ringed: blue until the game is decided, then green or red.
- Tap a card for everyone's picks and points, the ESPN model's odds, the
  national pick split and the Vegas line.
- ESPN hides every pick until kickoff, so upcoming games say so.

**What if** (`/whatif`)
- Tap who wins any game, including ones already played, and the week's
  standings re-sort with an animation. Presets: what happened, group favorites,
  and "my picks win".

**Season** (`/season`)
- Points behind first place after every week, where you finished each week,
  best week, and how often you beat the group average.

### Names

Most entries are called "Sam's 1st Entry". Custom entry names are kept;
default ones become a first name, with an initial when it is shared ("Sam M.",
"Sam L."). The ESPN username shows underneath. To use your own names, add them
to `src/config/nicknames.ts`, keyed by ESPN username.

## Setup

There is no configuration step. The app has no environment variables, no
database, and no league baked into it.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, paste a league id, and the dashboard loads. The id
is the last segment of your group URL on espn.com:

```
fantasy.espn.com/football/pickem/…/group/<league-id>
```

The league lives in the URL as `?league=<id>`, so it is shareable: send someone
the link and they get the same dashboard. Opening `/` with a league in your
browser history returns to the last one; `/?new=1` forces the setup screen.

### Why only the league id is needed

ESPN does not expose a reverse lookup from a league to its challenge through the
pick views, but `GET /apis/v1/groups/{id}` resolves one, and the numeric
challenge id it returns is accepted everywhere the readable challenge key is.
The season year is recovered from the challenge's first scoring period. So the
league id is sufficient to fetch a complete pool, and nothing else is baked in.

## Deploying to Vercel

The free tier is sufficient: one stateless route handler plus static pages, no
database and no cron jobs.

1. Push the repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
   Framework detection picks up Next.js; leave the build command as `next build`.
2. Deploy. There are no environment variables to add.

Notes for the free tier:
- Upstream results are cached in module scope for 60 seconds, so a burst of
  visitors collapses into roughly one set of upstream calls per minute per
  function instance. ESPN's own CDN caching does the rest.
- The route is `force-dynamic` and reads request parameters, so every cold start
  fetches fresh data.
- Team logos are rendered with a plain `<img>` so they do not consume Vercel's
  image optimisation quota.
- `maxDuration` is left at the platform default. If a cold start ever feels
  slow, raise it for the project rather than adding a cache.

## Data sources

All unauthenticated; the gambit API sends `access-control-allow-origin: *`.

| Purpose                | Endpoint |
| ---------------------- | -------- |
| League → challenge id  | `GET /apis/v1/groups/{leagueId}` |
| Challenge metadata     | `GET /apis/v1/challenges/{challengeId}?view=chui_default` |
| Group picks, entries   | `GET /apis/v1/challenges/{challengeId}/groups/{leagueId}?view=chui_pagetype_group_picks` |
| Season proposition archive | `GET /apis/v1/propositions?challengeId={id}` |
| Tiebreak questions     | `GET /apis/v1/tiebreakquestions?challengeId={id}` |
| Scoreboard, standings, weather | `site.web.api.espn.com/.../nfl/scoreboard` |
| Betting lines          | `site.web.api.espn.com/.../nfl/summary?event={id}` |
| BPI                    | `sports.core.api.espn.com/.../events/{id}/competitions/{id}/predictor` |

`site.api.espn.com` returns 403 to server-side requests, so all NFL data comes
from the hosts above.

## Scoring

Confidence format: each game is worth a distinct point value, and an entry
earns the value of a pick only if it is correct. There is no negative scoring,
and a missed pick simply earns nothing.

The engine in `src/lib/pool/simulate.ts` is verified against ESPN rather than
assumed: the test suite recomputes every entry-week in the pool from raw picks
and matches ESPN's reported score and win/loss record, and matches
`possiblePointsMax` on the in-progress week. Ranks use ESPN's competition-ranking
convention, so ties share a rank and the next rank is skipped.

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest, hits ESPN live
```

The test suite talks to ESPN, so it needs a league id and network access. Pass
`TEST_LEAGUE_ID=<group-id>` or put it in `.env.local` (gitignored). No league is
committed, so `npm test` will tell you what is missing rather than silently
verifying against a fixed pool.

## Layout

```
src/lib/espn/       upstream clients + payload types, normalization to PoolModel
src/lib/pool/       indexing, aggregation, ranking, weekly summary, simulation
src/app/api/pool/   cached route handler: league -> challenge -> enriched model
src/app/            / (Standings), /games, /whatif, /season
src/components/     screens, game card + detail sheet, league setup, shared UI
src/config/         nicknames
tests/              live correctness tests
```
