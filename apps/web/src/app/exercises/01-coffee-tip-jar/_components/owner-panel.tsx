"use client";

import { useEffect, useRef } from "react";
import { ArrowDownToLine, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TxStatus } from "@/components/web3/tx-status";
import {
  useCoffeeTipJarAddress,
  useIsOwner,
  useJarStats,
  useTipJarWrite,
} from "@/hooks/use-coffee-tip-jar";
import { describeTxError } from "@/lib/errors";
import { formatEthWithUnit } from "@/lib/format";

export function OwnerPanel() {
  const isOwner = useIsOwner();
  const { address, chainId } = useCoffeeTipJarAddress();
  const { balance, isLoading } = useJarStats();
  const { withdraw, hash, isPending, isConfirming, isConfirmed, error } = useTipJarWrite();

  const settledHash = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isConfirmed || hash === undefined || settledHash.current === hash) return;
    settledHash.current = hash;
    toast.success("Withdrawal confirmed", {
      description: "The whole jar balance was sent to the owner.",
    });
  }, [hash, isConfirmed]);

  if (!isOwner) return null;

  const withdrawable = balance ?? 0n;
  const isBusy = isPending || isConfirming;
  const showSkeleton = isLoading && Boolean(address);

  const onWithdraw = async () => {
    try {
      await withdraw();
    } catch (withdrawError) {
      toast.error(describeTxError(withdrawError));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          Owner panel
        </CardTitle>
        <CardDescription>
          You are the owner of this jar, so you can move the balance out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Withdrawable now</p>
          {showSkeleton ? (
            <Skeleton className="mt-1.5 h-6 w-28" />
          ) : (
            <p className="text-lg font-semibold tabular-nums">{formatEthWithUnit(withdrawable)}</p>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={isBusy || withdrawable === 0n}
          onClick={() => void onWithdraw()}
        >
          {isBusy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowDownToLine className="size-4" aria-hidden="true" />
          )}
          {isBusy ? "Withdrawing" : "Withdraw everything"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Withdrawing sends the full balance to the owner in one transfer. Anyone else calling{" "}
          <code className="font-mono">withdraw()</code> is rejected on-chain with{" "}
          <code className="font-mono">NotOwner</code>, and{" "}
          <code className="font-mono">totalTipped</code> keeps its historical value.
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
