"use client";

import { useCallback, useMemo, useState } from "react";
import { GameCard } from "@/components/games/GameCard";
import { GameSheet } from "@/components/games/GameSheet";
import { gameView } from "@/components/games/gameView";
import { PoolScreen, type PoolContext } from "@/components/PoolScreen";
import { Chip, PageHeader, WeekPicker } from "@/components/ui";

export default function GamesPage() {
  return <PoolScreen>{(ctx) => <Games {...ctx} />}</PoolScreen>;
}

type Filter = "all" | "mine" | "open";

function Games({ pool, index, people, meId }: PoolContext) {
  const [week, setWeek] = useState(pool.meta.currentWeek);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const views = useMemo(
    () => (index.gamesByWeek.get(week) ?? []).map((g) => gameView(g, index, people, meId)),
    [index, week, people, meId],
  );
  const shown = views.filter((v) =>
    filter === "mine" ? v.mine !== null : filter === "open" ? v.game.status !== "COMPLETE" : true,
  );
  const finals = views.filter((v) => v.game.status === "COMPLETE").length;
  const selected = views.find((v) => v.game.propId === openId) ?? null;
  const close = useCallback(() => setOpenId(null), []);

  return (
    <>
      <PageHeader
        eyebrow={`Week ${week} · ${finals === views.length ? "all final" : `${finals} of ${views.length} final`}`}
        title="Games"
        right={<WeekPicker weeks={pool.meta.weeks} value={week} onChange={setWeek} />}
      />
      <div role="group" aria-label="Filter games" className="flex gap-2 overflow-x-auto px-5 pb-3 pt-1">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        <Chip active={filter === "mine"} onClick={() => setFilter("mine")}>My picks</Chip>
        <Chip active={filter === "open"} onClick={() => setFilter("open")}>Still to play</Chip>
      </div>

      <div className="flex flex-col gap-2.5 px-4">
        {shown.map((v, i) => (
          <GameCard key={v.game.propId} view={v} meId={meId} index={i} onOpen={() => setOpenId(v.game.propId)} />
        ))}
        {shown.length === 0 ? (
          <p className="card px-5 py-8 text-center text-sm text-muted">
            {filter === "mine"
              ? "Your picks show up here once each game kicks off."
              : "Nothing left to play this week."}
          </p>
        ) : null}
      </div>

      <GameSheet view={selected} meId={meId} onClose={close} />
    </>
  );
}
