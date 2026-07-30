// Deployment registry consumed by apps/web through @lab/abi.
// Updated by `bun run deployments:sync` (reads packages/contracts/broadcast).
// Hand edits are fine: chain ids are merged, not replaced.

export const deployments = {
  CoffeeTipJar: {
    31337: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
  },
  TodoList: {
    31337: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
  },
} as const satisfies Record<string, Record<number, `0x${string}`>>;

export type ContractName = keyof typeof deployments;

/** Deployed address of `name` on `chainId`, or `undefined` when it is not deployed. */
export function getDeployment(name: ContractName, chainId: number): `0x${string}` | undefined {
  const byChain: Record<number, `0x${string}`> = deployments[name];
  return byChain[chainId];
}
