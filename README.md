# ESPN Pick'em Confidence Pool Dashboard

A read-only analytics dashboard for an ESPN NFL Pick'em **confidence** pool. It
visualises how the group distributes confidence against the national pool, adds
market/model context, and answers "what if this game had gone the other way?"

Everything is derived from ESPN's public APIs. There is no database, no login,
and nothing is written back to ESPN.

## What it shows

**Distribution** (`/`)
- A per-game bar split by the share of members on each side. Point at or tap a
  side to see who backed it, what confidence they put on it, and how the group
  compares with the national pool.
- Confidence ladder (histogram) for every game, so you can see whether the group
  is treating a game as a coin flip or a lock. Every chart shares the same
  1..16 axis, so shapes are directly comparable game to game; the rung numbers
  are shown on desktop and drop to the two endpoints on phones.
- Confidence heatmap of every member's allocation across the week's games.
- ESPN BPI (projected win probability), DraftKings moneyline and spread, and
  de-vigged implied win probability per side.
- Season trend: group average weekly score and how far the group's consensus sat
  from the national pool each week.
- League overview: average points, first place, and last place for the week.

**What if** (`/whatif`)
- Set a winner for any game, including flipping games that have already been
  scored, to backtest a decision.
- Weekly and season standings, recomputed from raw picks, with rank deltas,
  score deltas, and the best score still reachable.
- Presets: actual results, group consensus, model favourites, underdogs, random.
- The scenario is encoded in the URL, so a projection is shareable as a link.
- A self-check that recomputes every member's week from their raw picks and
  verifies it reproduces ESPN's reported scores, ranks, and `possiblePointsMax`.

Both pages are built mobile-first and work down to a 320px viewport.

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
src/app/            / (Distribution) and /whatif
src/components/     charts, league setup/gating, shared UI
tests/              live correctness tests
```
