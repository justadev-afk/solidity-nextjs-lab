import type { Chain } from "viem";
import { foundry, sepolia } from "viem/chains";

/** Local Anvil chain (id 31337) — the default target of the lab. */
export const localChain = foundry;

export const supportedChains = [foundry, sepolia] as const;

export function isSupportedChainId(id: number | undefined): boolean {
  if (id === undefined) return false;
  return supportedChains.some((chain) => chain.id === id);
}

export function chainName(id: number | undefined): string {
  if (id === undefined) return "No network";
  const chain: Chain | undefined = supportedChains.find((candidate) => candidate.id === id);
  return chain?.name ?? `Unsupported chain (${id})`;
}
