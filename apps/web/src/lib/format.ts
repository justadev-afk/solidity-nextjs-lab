import type { Chain } from "viem";
import { formatEther } from "viem";

import { supportedChains } from "@/lib/chains";

const EM_DASH = "—";

export function shortenAddress(address?: string, chars = 4): string {
  if (!address) return "";
  const visible = Math.max(1, Math.trunc(chars));
  const prefix = address.startsWith("0x") ? 2 : 0;
  if (address.length <= prefix + visible * 2 + 1) return address;
  return `${address.slice(0, prefix + visible)}…${address.slice(-visible)}`;
}

/** Wei → decimal ETH string without a unit suffix, e.g. `0.001`. */
export function formatEth(wei?: bigint, maxDecimals = 6): string {
  if (wei === undefined) return "0";

  const [whole = "0", fraction = ""] = formatEther(wei).split(".");
  if (fraction.length === 0 || maxDecimals <= 0) return whole;

  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, "");
  if (trimmed.length > 0) return `${whole}.${trimmed}`;

  // Non-zero but smaller than the requested precision.
  if (wei > 0n && whole === "0") return `< 0.${"0".repeat(maxDecimals - 1)}1`;
  return whole;
}

export function formatEthWithUnit(wei?: bigint): string {
  return `${formatEth(wei)} ETH`;
}

const textEncoder = new TextEncoder();

/**
 * UTF-8 byte length of a string — what Solidity's `bytes(s).length` actually measures.
 * A form that counts `String.length` instead will happily submit transactions that revert on a
 * byte limit, because one emoji is a single JS character but four bytes on chain.
 */
export function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}

export function formatTimestamp(seconds?: bigint): string {
  if (seconds === undefined) return EM_DASH;
  const date = new Date(Number(seconds) * 1000);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatRelativeTime(seconds?: bigint): string {
  if (seconds === undefined) return EM_DASH;

  const timestampMs = Number(seconds) * 1000;
  if (!Number.isFinite(timestampMs)) return EM_DASH;

  const elapsedSeconds = Math.floor((Date.now() - timestampMs) / 1000);
  if (elapsedSeconds < 5) return "just now";
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return formatTimestamp(seconds);
}

/** `undefined` for chains without a block explorer (Anvil). */
export function explorerTxUrl(chainId: number, hash: string): string | undefined {
  const chain: Chain | undefined = supportedChains.find((candidate) => candidate.id === chainId);
  const baseUrl = chain?.blockExplorers?.default.url;
  if (!baseUrl) return undefined;
  return `${baseUrl.replace(/\/+$/, "")}/tx/${hash}`;
}
