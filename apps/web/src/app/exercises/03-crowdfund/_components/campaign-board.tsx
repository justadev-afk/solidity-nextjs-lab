"use client";

import { useMemo, useState } from "react";
import { Megaphone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "wagmi";

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
import { TxStatus } from "@/components/web3/tx-status";
import {
  CAMPAIGN_PAGE_SIZE,
  deriveStatus,
  filterCampaigns,
  useCampaigns,
  useCrowdfundAddress,
  useCrowdfundWrite,
  useNowSeconds,
  useProtocolInfo,
  type CampaignFilter,
} from "@/hooks/use-crowdfund";
import { useMounted } from "@/hooks/use-mounted";
import { describeTxError } from "@/lib/errors";

import { CampaignCard } from "./campaign-card";

const SKELETON_ROWS = [0, 1, 2];

const FILTERS: readonly { id: CampaignFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "successful", label: "Successful" },
  { id: "failed", label: "Failed" },
  { id: "mine", label: "Mine" },
  { id: "backed", label: "Backed" },
];

export function CampaignBoard() {
  const mounted = useMounted();
  const { address, chainId } = useCrowdfundAddress();
  const { address: account } = useAccount();
  const nowSeconds = useNowSeconds();
  const { campaigns, extras, isLoading, refetch } = useCampaigns();
  const { campaignCount } = useProtocolInfo();
  const { contribute, claimFunds, claimRefund, hash, isPending, isConfirming, isConfirmed, error } =
    useCrowdfundWrite();

  const [filter, setFilter] = useState<CampaignFilter>("all");

  const isBusy = isPending || isConfirming;
  const showSkeleton = isLoading && Boolean(address);

  const visible = useMemo(
    () => filterCampaigns(campaigns, extras, filter, nowSeconds, account),
    [campaigns, extras, filter, nowSeconds, account],
  );

  const counts = useMemo<Record<CampaignFilter, number>>(() => {
    const empty: Record<CampaignFilter, number> = {
      all: 0,
      active: 0,
      successful: 0,
      failed: 0,
      mine: 0,
      backed: 0,
    };
    for (const entry of FILTERS) {
      empty[entry.id] = filterCampaigns(campaigns, extras, entry.id, nowSeconds, account).length;
    }
    return empty;
  }, [campaigns, extras, nowSeconds, account]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (cause) {
      toast.error(describeTxError(cause));
    }
  };

  const truncated = campaignCount !== undefined && campaignCount > CAMPAIGN_PAGE_SIZE;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns</CardTitle>
        <CardDescription>
          One shared registry, newest first. The status of each card is derived exactly the way{" "}
          <code className="font-mono">statusOf</code> derives it on chain — from the deadline, the
          amount pledged and the goal — so it costs no extra read.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => refetch()}
            aria-label="Refresh the campaign registry"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter campaigns">
          {FILTERS.map((entry) => (
            <Button
              key={entry.id}
              type="button"
              size="sm"
              variant={filter === entry.id ? "default" : "outline"}
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
              <span className="tabular-nums opacity-70">{counts[entry.id]}</span>
            </Button>
          ))}
        </div>

        {showSkeleton ? (
          <ul className="space-y-3">
            {SKELETON_ROWS.map((row) => (
              <li key={row} className="space-y-3 rounded-lg border p-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-3 w-32" />
              </li>
            ))}
          </ul>
        ) : !mounted || visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Megaphone className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">
              {campaigns.length === 0
                ? "No campaigns yet — open the first one"
                : "Nothing matches this filter"}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Anyone can create as many campaigns as they like: the registry has no owner and no
              cap, and ids are global rather than per address.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((campaign) => (
              <CampaignCard
                key={campaign.id.toString()}
                campaign={campaign}
                extras={extras.get(campaign.id.toString()) ?? { contribution: 0n, backers: 0n }}
                status={deriveStatus(campaign, nowSeconds)}
                isBusy={isBusy}
                account={account}
                nowSeconds={nowSeconds}
                onContribute={(amountEth) => void run(() => contribute(campaign.id, amountEth))}
                onClaimFunds={() => void run(() => claimFunds(campaign.id))}
                onClaimRefund={() => void run(() => claimRefund(campaign.id))}
              />
            ))}
          </ul>
        )}

        {truncated ? (
          <p className="text-xs text-muted-foreground">
            Showing the first {CAMPAIGN_PAGE_SIZE.toString()} of {campaignCount?.toString()}{" "}
            campaigns. <code className="font-mono">getCampaigns(offset, limit)</code> clamps the
            window instead of reverting, which is what makes paging safe here.
          </p>
        ) : null}

        <TxStatus
          hash={hash}
          isPending={isPending}
          isConfirming={isConfirming}
          isConfirmed={isConfirmed}
          error={error}
          chainId={chainId}
        />
      </CardContent>
    </Card>
  );
}
