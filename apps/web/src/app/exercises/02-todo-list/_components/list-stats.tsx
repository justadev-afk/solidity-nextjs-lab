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
import {
  MAX_TASKS_PER_OWNER,
  useListOwner,
  useListStats,
  useTodoListAddress,
} from "@/hooks/use-todo-list";

const EMPTY = "—";

type StatRow = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function ListStats() {
  const { address } = useTodoListAddress();
  const owner = useListOwner();
  const { taskCount, completedCount, nextTaskId, isLoading, refetch } = useListStats(owner);

  const showSkeleton = isLoading && Boolean(address) && owner !== undefined;

  const pending =
    taskCount === undefined || completedCount === undefined
      ? undefined
      : taskCount - completedCount;

  const rows: StatRow[] = [
    {
      label: "Tasks",
      value: taskCount === undefined ? EMPTY : `${taskCount.toString()} / ${MAX_TASKS_PER_OWNER}`,
      hint: "Live tasks against the on-chain cap.",
    },
    { label: "Completed", value: completedCount === undefined ? EMPTY : completedCount.toString() },
    { label: "Pending", value: pending === undefined ? EMPTY : pending.toString() },
    {
      label: "Next id",
      value: nextTaskId === undefined ? EMPTY : `#${nextTaskId.toString()}`,
      hint: "Ids are never reused, so this only goes up.",
    },
    { label: "Your list", value: <Address address={owner} showCopy /> },
    { label: "Contract", value: <Address address={address} showCopy /> },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your list</CardTitle>
        <CardDescription>Read straight from the contract, scoped to your address.</CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => refetch()}
            aria-label="Refresh list stats"
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
              className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <dt className="text-sm text-muted-foreground">
                {row.label}
                {row.hint ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground/70">{row.hint}</span>
                ) : null}
              </dt>
              <dd className="text-right text-sm font-medium tabular-nums">
                {showSkeleton ? <Skeleton className="h-4 w-20" /> : row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
