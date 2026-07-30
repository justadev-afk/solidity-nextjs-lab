"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { isAddress, parseEther } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";

import { coffeeTipJarAbi, getDeployment } from "@lab/abi";
import { localChain, supportedChains } from "@/lib/chains";
import { env } from "@/lib/env";
import { describeTxError } from "@/lib/errors";

export type Tip = {
  from: `0x${string}`;
  amount: bigint;
  name: string;
  message: string;
  timestamp: bigint;
};

export type TipInput = {
  name: string;
  message: string;
  valueEth: string;
};

export type JarStats = {
  owner: `0x${string}` | undefined;
  minimumTip: bigint | undefined;
  totalTipped: bigint | undefined;
  tipCount: bigint | undefined;
  balance: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export type TipsResult = {
  tips: readonly Tip[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export type TipJarWrite = {
  tip: (args: TipInput) => Promise<void>;
  withdraw: () => Promise<void>;
  hash: `0x${string}` | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: unknown;
  reset: () => void;
};

/**
 * Chain ids the wagmi config actually knows how to talk to. wagmi types every `chainId`
 * option as the union of the configured chain ids, so a plain `number` is not accepted.
 */
type TargetChainId = (typeof supportedChains)[number]["id"];

/** Shape of one `useReadContracts` entry, kept loose so narrowing stays explicit. */
type ReadEntry = { status: string; result?: unknown };

/** `useReadContracts` returns `[{ result, status }, ...]`; validate before reading it. */
function toReadEntries(data: unknown): readonly ReadEntry[] {
  if (!Array.isArray(data)) return [];
  return data.map((entry: unknown) =>
    typeof entry === "object" && entry !== null ? (entry as ReadEntry) : { status: "failure" },
  );
}

function successValue(entry: ReadEntry | undefined): unknown {
  return entry?.status === "success" ? entry.result : undefined;
}

function asBigInt(entry: ReadEntry | undefined): bigint | undefined {
  const value = successValue(entry);
  return typeof value === "bigint" ? value : undefined;
}

function asAddress(entry: ReadEntry | undefined): `0x${string}` | undefined {
  const value = successValue(entry);
  if (typeof value !== "string") return undefined;
  return isAddress(value, { strict: false }) ? value : undefined;
}

function parseTip(value: unknown): Tip | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<Record<keyof Tip, unknown>>;
  const { from, amount, name, message, timestamp } = candidate;
  if (typeof from !== "string" || !isAddress(from, { strict: false })) return undefined;
  if (typeof amount !== "bigint" || typeof timestamp !== "bigint") return undefined;
  if (typeof name !== "string" || typeof message !== "string") return undefined;
  return { from, amount, name, message, timestamp };
}

/**
 * Keeps a referentially stable callback so `useWatchContractEvent` does not
 * tear down and recreate its event filter on every render.
 */
function useStableHandler(handler: () => void): () => void {
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  return useCallback(() => {
    ref.current();
  }, []);
}

/** Falls back to the local chain whenever the wallet sits on a chain we do not configure. */
function toTargetChainId(id: number): TargetChainId {
  return supportedChains.find((chain) => chain.id === id)?.id ?? localChain.id;
}

function useTipJarTarget(): { address: `0x${string}` | undefined; chainId: TargetChainId } {
  const walletChainId = useChainId();
  const chainId = toTargetChainId(walletChainId);
  const address = env.NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS ?? getDeployment("CoffeeTipJar", chainId);

  return { address, chainId };
}

export function useCoffeeTipJarAddress(): {
  address: `0x${string}` | undefined;
  chainId: number;
} {
  return useTipJarTarget();
}

export function useJarStats(): JarStats {
  const { address, chainId } = useTipJarTarget();
  const enabled = Boolean(address);

  const reads = useReadContracts({
    contracts: [
      { address, abi: coffeeTipJarAbi, functionName: "owner", chainId },
      { address, abi: coffeeTipJarAbi, functionName: "minimumTip", chainId },
      { address, abi: coffeeTipJarAbi, functionName: "totalTipped", chainId },
      { address, abi: coffeeTipJarAbi, functionName: "tipCount", chainId },
    ],
    query: { enabled },
  });
  const balance = useBalance({ address, chainId, query: { enabled } });

  const refetchReads = reads.refetch;
  const refetchBalance = balance.refetch;
  const refetch = useCallback(() => {
    void refetchReads();
    void refetchBalance();
  }, [refetchReads, refetchBalance]);
  const onLogs = useStableHandler(refetch);

  useWatchContractEvent({
    address,
    abi: coffeeTipJarAbi,
    chainId,
    eventName: "TipReceived",
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: coffeeTipJarAbi,
    chainId,
    eventName: "Withdrawn",
    enabled,
    onLogs,
  });

  const entries = toReadEntries(reads.data);
  const hasFailedRead = entries.length > 0 && entries.some((entry) => entry.status !== "success");

  return {
    owner: asAddress(entries[0]),
    minimumTip: asBigInt(entries[1]),
    totalTipped: asBigInt(entries[2]),
    tipCount: asBigInt(entries[3]),
    balance: balance.data?.value,
    isLoading: reads.isLoading || balance.isLoading,
    isError: reads.isError || balance.isError || hasFailedRead,
    refetch,
  };
}

export function useTips(): TipsResult {
  const { address, chainId } = useTipJarTarget();
  const enabled = Boolean(address);

  const read = useReadContract({
    address,
    abi: coffeeTipJarAbi,
    functionName: "getTips",
    chainId,
    query: { enabled },
  });

  const refetchTips = read.refetch;
  const refetch = useCallback(() => {
    void refetchTips();
  }, [refetchTips]);
  const onLogs = useStableHandler(refetch);

  useWatchContractEvent({
    address,
    abi: coffeeTipJarAbi,
    chainId,
    eventName: "TipReceived",
    enabled,
    onLogs,
  });

  // Contract order (oldest first); the feed decides how to display it.
  const tips = useMemo<readonly Tip[]>(() => {
    const raw = read.data;
    if (!Array.isArray(raw)) return [];
    const parsed: Tip[] = [];
    for (const entry of raw) {
      const tip = parseTip(entry);
      if (tip !== undefined) parsed.push(tip);
    }
    return parsed;
  }, [read.data]);

  return { tips, isLoading: read.isLoading, isError: read.isError, refetch };
}

export function useIsOwner(): boolean {
  const { address, chainId } = useTipJarTarget();
  const { address: account } = useAccount();

  const read = useReadContract({
    address,
    abi: coffeeTipJarAbi,
    functionName: "owner",
    chainId,
    query: { enabled: Boolean(address) },
  });

  const owner: unknown = read.data;
  if (!account || typeof owner !== "string") return false;

  return owner.toLowerCase() === account.toLowerCase();
}

export function useTipJarWrite(): TipJarWrite {
  const { address, chainId } = useTipJarTarget();
  const {
    data: hash,
    error: writeError,
    isPending,
    reset,
    writeContractAsync,
  } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId });

  const tip = useCallback(
    async ({ name, message, valueEth }: TipInput): Promise<void> => {
      if (!address) {
        toast.error("No CoffeeTipJar address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: coffeeTipJarAbi,
          chainId,
          functionName: "tip",
          args: [name, message],
          value: parseEther(valueEth),
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const withdraw = useCallback(async (): Promise<void> => {
    if (!address) {
      toast.error("No CoffeeTipJar address for this network — deploy it first.");
      return;
    }

    try {
      await writeContractAsync({
        address,
        abi: coffeeTipJarAbi,
        chainId,
        functionName: "withdraw",
      });
    } catch (cause) {
      toast.error(describeTxError(cause));
    }
  }, [address, chainId, writeContractAsync]);

  const error: unknown = writeError ?? receipt.error ?? undefined;

  return {
    tip,
    withdraw,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isConfirmed: receipt.isSuccess,
    error,
    reset,
  };
}
