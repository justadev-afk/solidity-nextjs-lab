"use client";

import { TriangleAlert } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { chainName, isSupportedChainId, localChain } from "@/lib/chains";

type NetworkGuardProps = {
  className?: string;
};

export function NetworkGuard({ className }: NetworkGuardProps) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || isSupportedChainId(chainId)) return null;

  return (
    <Alert variant="destructive" className={className}>
      <TriangleAlert className="size-4" aria-hidden="true" />
      <AlertTitle>Unsupported network: {chainName(chainId)}</AlertTitle>
      <AlertDescription className="gap-3">
        <p>
          This exercise talks to the local Anvil chain (id {localChain.id}). Switch your wallet to a
          supported network to read and write the contract.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => switchChain({ chainId: localChain.id })}
        >
          {isPending ? "Switching…" : `Switch to ${localChain.name}`}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
