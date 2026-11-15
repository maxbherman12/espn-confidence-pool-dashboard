"use client";

import { PoolScreen, type PoolContext } from "@/components/PoolScreen";
import { SeasonStats, useSeasonStats } from "@/components/SeasonStats";
import { PageHeader } from "@/components/ui";

export default function SeasonPage() {
  return <PoolScreen>{(ctx) => <Season {...ctx} />}</PoolScreen>;
}

function Season({ pool, index, people, meId }: PoolContext) {
  const weeks = useSeasonStats(pool, index, meId).length;
  const person = people.get(meId)!;

  return (
    <>
      <PageHeader
        eyebrow={weeks ? `${person.name} · ${weeks} weeks played` : person.name}
        title="Season"
      />
      <SeasonStats pool={pool} index={index} entryId={meId} you />
    </>
  );
}
