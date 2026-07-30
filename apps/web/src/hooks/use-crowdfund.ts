"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";

import { crowdfundAbi, getDeployment } from "@lab/abi";
import { localChain, supportedChains } from "@/lib/chains";
import { env } from "@/lib/env";
import { describeTxError } from "@/lib/errors";

/** Mirrors `ICrowdfund.Campaign`. `uint64 deadline` comes back from viem as a `bigint`. */
export type Campaign = {
  id: bigint;
  creator: `0x${string}`;
  deadline: bigint;
  claimed: boolean;
  title: string;
  goal: bigint;
  pledged: bigint;
};

/**
 * Mirrors `ICrowdfund.Status`. The contract derives it from `block.timestamp`, `pledged` and
 * `goal`, and so does `deriveStatus` below — there is no state to read, so no read to make.
 */
export type CampaignStatus = "active" | "successful" | "failed";

export type CampaignFilter = "all" | "active" | "successful" | "failed" | "mine" | "backed";

/** Per-campaign numbers that need one contract read each, batched into a single multicall. */
export type CampaignExtras = {
  /** What the connected wallet currently has staked, and can therefore get refunded. */
  contribution: bigint;
  /** Distinct addresses that have ever backed the campaign. */
  backers: bigint;
};

export type ProtocolInfo = {
  owner: `0x${string}` | undefined;
  protocolFees: bigint | undefined;
  campaignCount: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export type CampaignsResult = {
  campaigns: readonly Campaign[];
  extras: ReadonlyMap<string, CampaignExtras>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export type CrowdfundWrite = {
  createCampaign: (title: string, goalEth: string, durationSeconds: bigint) => Promise<void>;
  contribute: (id: bigint, amountEth: string) => Promise<void>;
  claimFunds: (id: bigint) => Promise<void>;
  claimRefund: (id: bigint) => Promise<void>;
  withdrawProtocolFees: () => Promise<void>;
  hash: `0x${string}` | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: unknown;
  reset: () => void;
};

/** Contract-side tuning. Not on the interface (see `ICrowdfund`), so the UI mirrors it. */
export const FEE_BPS = 200n;
export const BPS_DENOMINATOR = 10_000n;
export const MIN_DURATION = 3_600n; // 1 hour
export const MAX_DURATION = 7_776_000n; // 90 days
export const MAX_TITLE_LENGTH = 80;

/**
 * How many campaigns the board pulls in one `getCampaigns` call. The registry is append-only and
 * public, so it grows for everybody; the contract clamps the window instead of reverting, which
 * is what makes a fixed cap safe here.
 */
export const CAMPAIGN_PAGE_SIZE = 100n;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

type TargetChainId = (typeof supportedChains)[number]["id"];

type ReadEntry = { status: string; result?: unknown };

function toReadEntries(data: unknown): readonly ReadEntry[] {
  if (!Array.isArray(data)) return [];
  return data.map((entry: unknown) =>
    typeof entry === "object" && entry !== null ? (entry as ReadEntry) : { status: "failure" },
  );
}

function asBigInt(entry: ReadEntry | undefined): bigint | undefined {
  if (entry?.status !== "success") return undefined;
  const value: unknown = entry.result;
  return typeof value === "bigint" ? value : undefined;
}

function asAddress(entry: ReadEntry | undefined): `0x${string}` | undefined {
  if (entry?.status !== "success") return undefined;
  const value: unknown = entry.result;
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? (value as `0x${string}`)
    : undefined;
}

function parseCampaign(value: unknown): Campaign | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<Record<keyof Campaign, unknown>>;
  const { id, creator, deadline, claimed, title, goal, pledged } = candidate;
  if (typeof id !== "bigint" || typeof deadline !== "bigint") return undefined;
  if (typeof goal !== "bigint" || typeof pledged !== "bigint") return undefined;
  if (typeof title !== "string" || typeof claimed !== "boolean") return undefined;
  if (typeof creator !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(creator)) return undefined;
  return { id, creator: creator as `0x${string}`, deadline, claimed, title, goal, pledged };
}

/**
 * The exact rule `Crowdfund.statusOf` applies, evaluated on the client so a board of N campaigns
 * costs zero extra reads.
 *
 * The catch is that `nowSeconds` is the browser's clock, not the chain's. They agree closely
 * enough to render a card, but the chain is always the authority: a transaction sent one second
 * either side of a deadline can still come back with `InvalidStatus`.
 */
export function deriveStatus(campaign: Campaign, nowSeconds: bigint): CampaignStatus {
  if (nowSeconds < campaign.deadline) return "active";
  return campaign.pledged >= campaign.goal ? "successful" : "failed";
}

/**
 * A coarse clock in unix seconds, so a card can cross its own deadline without a reload. It ticks
 * every 30 seconds because that is the resolution `formatTimeLeft` renders anyway.
 */
export function useNowSeconds(intervalMs = 30_000): bigint {
  const [now, setNow] = useState<bigint>(() => BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(BigInt(Math.floor(Date.now() / 1000)));
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}

export function protocolFeeOf(pledged: bigint): bigint {
  return (pledged * FEE_BPS) / BPS_DENOMINATOR;
}

export function payoutOf(pledged: bigint): bigint {
  return pledged - protocolFeeOf(pledged);
}

/** 0 to 100, clamped: a campaign may overshoot its goal and the bar must not run off the card. */
export function fundedPercent(campaign: Campaign): number {
  if (campaign.goal === 0n) return 0;
  const raw = Number((campaign.pledged * 1_000n) / campaign.goal) / 10;
  return Math.min(100, Math.max(0, raw));
}

function useStableHandler(handler: () => void): () => void {
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  return useCallback(() => {
    ref.current();
  }, []);
}

function toTargetChainId(id: number): TargetChainId {
  return supportedChains.find((chain) => chain.id === id)?.id ?? localChain.id;
}

function useCrowdfundTarget(): { address: `0x${string}` | undefined; chainId: TargetChainId } {
  const walletChainId = useChainId();
  const chainId = toTargetChainId(walletChainId);
  const address = env.NEXT_PUBLIC_CROWDFUND_ADDRESS ?? getDeployment("Crowdfund", chainId);

  return { address, chainId };
}

export function useCrowdfundAddress(): { address: `0x${string}` | undefined; chainId: number } {
  return useCrowdfundTarget();
}

/**
 * Refetches `handler` on every event the protocol emits. Unlike exercise 02 there is no `owner`
 * topic to filter on: the registry is shared, so anybody's campaign changes what is on screen.
 *
 * The five calls are written out one by one on purpose — a loop over the event names would call
 * hooks inside a loop, which the rules of hooks forbid.
 */
function useProtocolEvents(handler: () => void): void {
  const { address, chainId } = useCrowdfundTarget();
  const enabled = Boolean(address);
  const onLogs = useStableHandler(handler);

  useWatchContractEvent({
    address,
    abi: crowdfundAbi,
    chainId,
    eventName: "CampaignCreated",
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: crowdfundAbi,
    chainId,
    eventName: "ContributionMade",
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: crowdfundAbi,
    chainId,
    eventName: "FundsClaimed",
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: crowdfundAbi,
    chainId,
    eventName: "RefundIssued",
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: crowdfundAbi,
    chainId,
    eventName: "ProtocolFeesWithdrawn",
    enabled,
    onLogs,
  });
}

export function useProtocolInfo(): ProtocolInfo {
  const { address, chainId } = useCrowdfundTarget();

  const reads = useReadContracts({
    contracts: [
      { address, abi: crowdfundAbi, functionName: "owner", chainId },
      { address, abi: crowdfundAbi, functionName: "protocolFees", chainId },
      { address, abi: crowdfundAbi, functionName: "campaignCount", chainId },
    ],
    query: { enabled: Boolean(address) },
  });

  const refetchReads = reads.refetch;
  const refetch = useCallback(() => {
    void refetchReads();
  }, [refetchReads]);

  useProtocolEvents(refetch);

  const entries = toReadEntries(reads.data);
  const hasFailedRead = entries.length > 0 && entries.some((entry) => entry.status !== "success");

  return {
    owner: asAddress(entries[0]),
    protocolFees: asBigInt(entries[1]),
    campaignCount: asBigInt(entries[2]),
    isLoading: reads.isLoading,
    isError: reads.isError || hasFailedRead,
    refetch,
  };
}

export function useIsProtocolOwner(): boolean {
  const { address } = useAccount();
  const { owner } = useProtocolInfo();

  if (address === undefined || owner === undefined) return false;
  return address.toLowerCase() === owner.toLowerCase();
}

/**
 * The whole board: one `getCampaigns` call for the registry, then one multicall for the
 * per-campaign numbers that depend on the connected wallet.
 */
export function useCampaigns(): CampaignsResult {
  const { address, chainId } = useCrowdfundTarget();
  const { address: account } = useAccount();
  const enabled = Boolean(address);

  const registry = useReadContract({
    address,
    abi: crowdfundAbi,
    functionName: "getCampaigns",
    args: [0n, CAMPAIGN_PAGE_SIZE],
    chainId,
    query: { enabled },
  });

  // Newest first: the contract returns ascending ids because that is the cheap direction on
  // chain, and reversing a page of 100 in the browser costs nothing.
  const campaigns = useMemo<readonly Campaign[]>(() => {
    const raw = registry.data;
    if (!Array.isArray(raw)) return [];
    const parsed: Campaign[] = [];
    for (const entry of raw) {
      const campaign = parseCampaign(entry);
      if (campaign !== undefined) parsed.push(campaign);
    }
    return parsed.sort((left, right) => (left.id < right.id ? 1 : left.id > right.id ? -1 : 0));
  }, [registry.data]);

  const detailReads = useReadContracts({
    contracts: campaigns.flatMap((campaign) => [
      {
        address,
        abi: crowdfundAbi,
        functionName: "contributionOf" as const,
        args: [campaign.id, account ?? ZERO_ADDRESS] as const,
        chainId,
      },
      {
        address,
        abi: crowdfundAbi,
        functionName: "backerCount" as const,
        args: [campaign.id] as const,
        chainId,
      },
    ]),
    query: { enabled: enabled && campaigns.length > 0 },
  });

  const extras = useMemo<ReadonlyMap<string, CampaignExtras>>(() => {
    const entries = toReadEntries(detailReads.data);
    const map = new Map<string, CampaignExtras>();
    campaigns.forEach((campaign, index) => {
      map.set(campaign.id.toString(), {
        contribution: asBigInt(entries[index * 2]) ?? 0n,
        backers: asBigInt(entries[index * 2 + 1]) ?? 0n,
      });
    });
    return map;
  }, [campaigns, detailReads.data]);

  const refetchRegistry = registry.refetch;
  const refetchDetails = detailReads.refetch;
  const refetch = useCallback(() => {
    void refetchRegistry();
    void refetchDetails();
  }, [refetchRegistry, refetchDetails]);

  useProtocolEvents(refetch);

  return {
    campaigns,
    extras,
    isLoading: registry.isLoading,
    isError: registry.isError,
    refetch,
  };
}

export function useCrowdfundWrite(): CrowdfundWrite {
  const { address, chainId } = useCrowdfundTarget();
  const {
    data: hash,
    error: writeError,
    isPending,
    reset,
    writeContractAsync,
  } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId });

  const createCampaign = useCallback(
    async (title: string, goalEth: string, durationSeconds: bigint): Promise<void> => {
      if (!address) {
        toast.error("No Crowdfund address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: crowdfundAbi,
          chainId,
          functionName: "createCampaign",
          args: [title, parseEther(goalEth), durationSeconds],
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const contribute = useCallback(
    async (id: bigint, amountEth: string): Promise<void> => {
      if (!address) {
        toast.error("No Crowdfund address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: crowdfundAbi,
          chainId,
          functionName: "contribute",
          args: [id],
          value: parseEther(amountEth),
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const claimFunds = useCallback(
    async (id: bigint): Promise<void> => {
      if (!address) {
        toast.error("No Crowdfund address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: crowdfundAbi,
          chainId,
          functionName: "claimFunds",
          args: [id],
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const claimRefund = useCallback(
    async (id: bigint): Promise<void> => {
      if (!address) {
        toast.error("No Crowdfund address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: crowdfundAbi,
          chainId,
          functionName: "claimRefund",
          args: [id],
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const withdrawProtocolFees = useCallback(async (): Promise<void> => {
    if (!address) {
      toast.error("No Crowdfund address for this network — deploy it first.");
      return;
    }

    try {
      await writeContractAsync({
        address,
        abi: crowdfundAbi,
        chainId,
        functionName: "withdrawProtocolFees",
      });
    } catch (cause) {
      toast.error(describeTxError(cause));
    }
  }, [address, chainId, writeContractAsync]);

  const error: unknown = writeError ?? receipt.error ?? undefined;

  return {
    createCampaign,
    contribute,
    claimFunds,
    claimRefund,
    withdrawProtocolFees,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isConfirmed: receipt.isSuccess,
    error,
    reset,
  };
}

export function filterCampaigns(
  campaigns: readonly Campaign[],
  extras: ReadonlyMap<string, CampaignExtras>,
  filter: CampaignFilter,
  nowSeconds: bigint,
  account: `0x${string}` | undefined,
): readonly Campaign[] {
  if (filter === "all") return campaigns;

  if (filter === "mine") {
    if (account === undefined) return [];
    const lowered = account.toLowerCase();
    return campaigns.filter((campaign) => campaign.creator.toLowerCase() === lowered);
  }

  if (filter === "backed") {
    if (account === undefined) return [];
    return campaigns.filter(
      (campaign) => (extras.get(campaign.id.toString())?.contribution ?? 0n) > 0n,
    );
  }

  return campaigns.filter((campaign) => deriveStatus(campaign, nowSeconds) === filter);
}

/** Guard used by the "no contract here" banner: an address that never answers a read. */
export function useCrowdfundUnavailable(): boolean {
  const { address, chainId } = useCrowdfundTarget();

  const read = useReadContract({
    address,
    abi: crowdfundAbi,
    functionName: "campaignCount",
    chainId,
    query: { enabled: Boolean(address) },
  });

  return Boolean(address) && !read.isLoading && read.data === undefined;
}
