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
  useCampaigns,
  useCrowdfundAddress,
  useNowSeconds,
  useProtocolInfo,
  deriveStatus,
} from "@/hooks/use-crowdfund";
import { formatEthWithUnit } from "@/lib/format";

const EMPTY = "—";

type StatRow = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function ProtocolStats() {
  const { address } = useCrowdfundAddress();
  const { owner, protocolFees, campaignCount, isLoading, refetch } = useProtocolInfo();
  const { campaigns } = useCampaigns();
  const nowSeconds = useNowSeconds();

  const showSkeleton = isLoading && Boolean(address);

  const live = campaigns.filter((campaign) => deriveStatus(campaign, nowSeconds) === "active");
  const raised = live.reduce((total, campaign) => total + campaign.pledged, 0n);

  const rows: StatRow[] = [
    {
      label: "Campaigns",
      value: campaignCount === undefined ? EMPTY : campaignCount.toString(),
      hint: "Global, append-only registry — ids are never reused.",
    },
    { label: "Active now", value: live.length.toString() },
    {
      label: "Locked in active campaigns",
      value: formatEthWithUnit(raised),
      hint: "Refundable to the backers if those campaigns miss their goal.",
    },
    {
      label: "Protocol fees",
      value: protocolFees === undefined ? EMPTY : formatEthWithUnit(protocolFees),
      hint: "2% of every campaign that succeeded and was claimed.",
    },
    { label: "Protocol owner", value: <Address address={owner} showCopy /> },
    { label: "Contract", value: <Address address={address} showCopy /> },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocol</CardTitle>
        <CardDescription>
          The only privilege the deployer holds is sweeping the fee. It cannot create, cancel or
          claim anybody&apos;s campaign.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => refetch()}
            aria-label="Refresh the protocol stats"
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
