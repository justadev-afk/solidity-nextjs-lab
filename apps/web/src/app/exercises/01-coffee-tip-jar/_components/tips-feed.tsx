"use client";

import { useMemo } from "react";
import { Coffee, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { useCoffeeTipJarAddress, useTips, type Tip } from "@/hooks/use-coffee-tip-jar";
import { formatEthWithUnit, formatRelativeTime, formatTimestamp } from "@/lib/format";

const SKELETON_ROWS = [0, 1, 2];

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function TipRow({ tip }: { tip: Tip }) {
  const displayName = tip.name.trim() === "" ? "Anonymous" : tip.name.trim();

  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {initialOf(tip.name)}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{displayName}</span>
          <Address address={tip.from} className="text-xs" />
          <span className="text-xs text-muted-foreground" title={formatTimestamp(tip.timestamp)}>
            {formatRelativeTime(tip.timestamp)}
          </span>
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {formatEthWithUnit(tip.amount)}
          </Badge>
        </div>
        <p className="text-sm break-words text-muted-foreground">{tip.message}</p>
      </div>
    </li>
  );
}

export function TipsFeed() {
  const { address } = useCoffeeTipJarAddress();
  const { tips, isLoading, refetch } = useTips();

  const newestFirst = useMemo(() => [...tips].reverse(), [tips]);
  const showSkeleton = isLoading && Boolean(address);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent tips</CardTitle>
        <CardDescription>
          Newest first, updated live from the <code className="font-mono">TipReceived</code> event.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => refetch()}
            aria-label="Refresh the tips feed"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <ul className="divide-y divide-border">
            {SKELETON_ROWS.map((row) => (
              <li key={row} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-full max-w-sm" />
                </div>
              </li>
            ))}
          </ul>
        ) : newestFirst.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Coffee className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No tips yet — be the first to buy a coffee ☕</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Every tip is stored on-chain with its name, message and timestamp.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {newestFirst.map((tip, index) => (
              <TipRow key={`${tip.from}-${tip.timestamp.toString()}-${index}`} tip={tip} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
