"use client";

import { useEffect, useRef } from "react";
import { ArrowDownToLine, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TxStatus } from "@/components/web3/tx-status";
import {
  useCrowdfundAddress,
  useCrowdfundWrite,
  useIsProtocolOwner,
  useProtocolInfo,
} from "@/hooks/use-crowdfund";
import { describeTxError } from "@/lib/errors";
import { formatEthWithUnit } from "@/lib/format";

export function OwnerPanel() {
  const isOwner = useIsProtocolOwner();
  const { address, chainId } = useCrowdfundAddress();
  const { protocolFees, isLoading } = useProtocolInfo();
  const { withdrawProtocolFees, hash, isPending, isConfirming, isConfirmed, error } =
    useCrowdfundWrite();

  const settledHash = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isConfirmed || hash === undefined || settledHash.current === hash) return;
    settledHash.current = hash;
    toast.success("Fees swept", { description: "The accrued protocol fees are on their way." });
  }, [hash, isConfirmed]);

  if (!isOwner) return null;

  const accrued = protocolFees ?? 0n;
  const isBusy = isPending || isConfirming;
  const showSkeleton = isLoading && Boolean(address);

  const onWithdraw = async () => {
    try {
      await withdrawProtocolFees();
    } catch (withdrawError) {
      toast.error(describeTxError(withdrawError));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          Protocol owner
        </CardTitle>
        <CardDescription>
          You deployed this contract, so the 2% taken from successful campaigns is yours to sweep.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Accrued fees</p>
          {showSkeleton ? (
            <Skeleton className="mt-1.5 h-6 w-28" />
          ) : (
            <p className="text-lg font-semibold tabular-nums">{formatEthWithUnit(accrued)}</p>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={isBusy || accrued === 0n}
          onClick={() => void onWithdraw()}
        >
          {isBusy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowDownToLine className="size-4" aria-hidden="true" />
          )}
          {isBusy ? "Sweeping" : "Sweep the fees"}
        </Button>

        <p className="text-xs text-muted-foreground">
          A fee is only credited when a creator calls <code className="font-mono">claimFunds</code>,
          so this figure lags behind the campaigns that have already succeeded. Money still owed to
          backers is never part of it — that separation is the point of keeping{" "}
          <code className="font-mono">protocolFees</code> as its own counter instead of reading the
          contract balance.
        </p>

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
