"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Address } from "@/components/web3/address";
import { useCoffeeTipJarAddress, useJarStats } from "@/hooks/use-coffee-tip-jar";
import { formatEthWithUnit } from "@/lib/format";

const EMPTY = "—";

type StatRow = {
  label: string;
  value: ReactNode;
};

export function JarStats() {
  const { address } = useCoffeeTipJarAddress();
  const { owner, minimumTip, totalTipped, tipCount, balance, isLoading, refetch } = useJarStats();

  const showSkeleton = isLoading && Boolean(address);

  const rows: StatRow[] = [
    { label: "Balance", value: balance === undefined ? EMPTY : formatEthWithUnit(balance) },
    {
      label: "Total tipped",
      value: totalTipped === undefined ? EMPTY : formatEthWithUnit(totalTipped),
    },
    { label: "Tips received", value: tipCount === undefined ? EMPTY : tipCount.toString() },
    {
      label: "Minimum tip",
      value: minimumTip === undefined ? EMPTY : formatEthWithUnit(minimumTip),
    },
    { label: "Owner", value: owner === undefined ? EMPTY : <Address address={owner} showCopy /> },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jar stats</CardTitle>
        <CardDescription>Read straight from the contract.</CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => refetch()}
            aria-label="Refresh jar stats"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-right text-sm font-medium tabular-nums">
                {showSkeleton ? <Skeleton className="h-4 w-24" /> : row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
