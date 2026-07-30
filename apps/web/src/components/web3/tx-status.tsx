"use client";

import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, ExternalLink, LoaderCircle } from "lucide-react";

import { localChain } from "@/lib/chains";
import { describeTxError } from "@/lib/errors";
import { explorerTxUrl, shortenAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

type TxStatusProps = {
  hash?: `0x${string}`;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error?: unknown;
  chainId?: number;
  className?: string;
};

export function TxStatus({
  hash,
  isPending,
  isConfirming,
  isConfirmed,
  error,
  chainId,
  className,
}: TxStatusProps) {
  if (error) {
    return (
      <p role="alert" className={cn("flex items-start gap-2 text-sm text-destructive", className)}>
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{describeTxError(error)}</span>
      </p>
    );
  }

  let icon: ReactNode = null;
  let label = "";

  if (isPending) {
    icon = <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />;
    label = "Confirm the transaction in your wallet…";
  } else if (isConfirming) {
    icon = <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />;
    label = "Waiting for the transaction to be mined…";
  } else if (isConfirmed) {
    icon = <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />;
    label = "Transaction confirmed";
  } else {
    return null;
  }

  const explorerUrl =
    hash !== undefined && chainId !== undefined && chainId !== localChain.id
      ? explorerTxUrl(chainId, hash)
      : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
      {hash !== undefined && explorerUrl !== undefined ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs underline underline-offset-4 hover:text-foreground"
        >
          {shortenAddress(hash, 6)}
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
        </a>
      ) : null}
      {hash !== undefined && explorerUrl === undefined ? (
        <span className="font-mono text-xs">{shortenAddress(hash, 6)}</span>
      ) : null}
    </div>
  );
}
