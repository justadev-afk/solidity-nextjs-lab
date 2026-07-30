"use client";

import { useState } from "react";
import { Ban, CircleCheck, Clock, HandCoins, LoaderCircle, Undo2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Address } from "@/components/web3/address";
import {
  fundedPercent,
  payoutOf,
  protocolFeeOf,
  type Campaign,
  type CampaignExtras,
  type CampaignStatus,
} from "@/hooks/use-crowdfund";
import { formatEth, formatEthWithUnit, formatTimeLeft, formatTimestamp } from "@/lib/format";

const STATUS_BADGE: Record<
  CampaignStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  active: { label: "Active", variant: "default" },
  successful: { label: "Successful", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

/** `parseEther` throws on anything that is not a decimal number, so the input is checked first. */
function isValidAmount(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  return Number(trimmed) > 0;
}

type CampaignCardProps = {
  campaign: Campaign;
  extras: CampaignExtras;
  status: CampaignStatus;
  isBusy: boolean;
  account: `0x${string}` | undefined;
  nowSeconds: bigint;
  onContribute: (amountEth: string) => void;
  onClaimFunds: () => void;
  onClaimRefund: () => void;
};

export function CampaignCard({
  campaign,
  extras,
  status,
  isBusy,
  account,
  nowSeconds,
  onContribute,
  onClaimFunds,
  onClaimRefund,
}: CampaignCardProps) {
  const [amount, setAmount] = useState("");

  const badge = STATUS_BADGE[status];
  const percent = fundedPercent(campaign);
  const isCreator =
    account !== undefined && account.toLowerCase() === campaign.creator.toLowerCase();
  const canSubmitAmount = isValidAmount(amount);

  const fee = protocolFeeOf(campaign.pledged);
  const payout = payoutOf(campaign.pledged);

  return (
    <li className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium break-words">{campaign.title}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-mono font-normal">
              #{campaign.id.toString()}
            </Badge>
            <span>by</span>
            <Address address={campaign.creator} showCopy={false} />
            {isCreator ? <Badge variant="outline">yours</Badge> : null}
          </div>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="space-y-1.5">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Campaign ${campaign.id.toString()} funding progress`}
        >
          <div
            className={status === "failed" ? "h-full bg-muted-foreground/50" : "h-full bg-primary"}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
          <span className="font-medium tabular-nums">
            {formatEth(campaign.pledged)} / {formatEthWithUnit(campaign.goal)}
          </span>
          <span className="text-muted-foreground tabular-nums">{percent.toFixed(1)}% funded</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" aria-hidden="true" />
          {extras.backers.toString()} {extras.backers === 1n ? "backer" : "backers"}
        </span>
        <span className="inline-flex items-center gap-1" title={formatTimestamp(campaign.deadline)}>
          <Clock className="size-3.5" aria-hidden="true" />
          {status === "active"
            ? formatTimeLeft(campaign.deadline, Number(nowSeconds) * 1000)
            : `ended ${formatTimestamp(campaign.deadline)}`}
        </span>
        {extras.contribution > 0n ? (
          <span className="text-foreground">
            you backed {formatEthWithUnit(extras.contribution)}
          </span>
        ) : null}
      </div>

      {status === "active" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={amount}
            inputMode="decimal"
            placeholder="0.5"
            aria-label={`Amount in ETH to back campaign ${campaign.id.toString()}`}
            disabled={isBusy}
            className="w-32"
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmitAmount) {
                onContribute(amount.trim());
                setAmount("");
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={isBusy || !canSubmitAmount || account === undefined}
            onClick={() => {
              onContribute(amount.trim());
              setAmount("");
            }}
          >
            {isBusy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <HandCoins className="size-4" aria-hidden="true" />
            )}
            Back this campaign
          </Button>
          <span className="text-xs text-muted-foreground">
            Refundable in full if the goal is missed.
          </span>
        </div>
      ) : null}

      {status === "successful" ? (
        <div className="flex flex-wrap items-center gap-2">
          {campaign.claimed ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleCheck className="size-4 text-primary" aria-hidden="true" />
              Paid out: {formatEthWithUnit(payout)} to the creator, {formatEthWithUnit(fee)} kept as
              protocol fee.
            </span>
          ) : isCreator ? (
            <>
              <Button type="button" size="sm" disabled={isBusy} onClick={onClaimFunds}>
                {isBusy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <HandCoins className="size-4" aria-hidden="true" />
                )}
                Claim {formatEthWithUnit(payout)}
              </Button>
              <span className="text-xs text-muted-foreground">
                The protocol keeps {formatEthWithUnit(fee)} (2%).
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Goal reached. Only the creator can claim the {formatEthWithUnit(payout)} payout.
            </span>
          )}
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="flex flex-wrap items-center gap-2">
          {extras.contribution > 0n ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isBusy}
              onClick={onClaimRefund}
            >
              {isBusy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Undo2 className="size-4" aria-hidden="true" />
              )}
              Claim refund of {formatEthWithUnit(extras.contribution)}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Ban className="size-4" aria-hidden="true" />
              Goal missed. Every backer can pull their contribution back, in full and without a fee.
            </span>
          )}
        </div>
      ) : null}
    </li>
  );
}
