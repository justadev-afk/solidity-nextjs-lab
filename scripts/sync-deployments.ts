#!/usr/bin/env bun
/**
 * Rewrites `packages/abi/src/deployments.ts` from the Foundry broadcast logs in
 * `packages/contracts/broadcast`.
 *
 *   bun run deployments:sync   # == bun run scripts/sync-deployments.ts
 *
 * It looks for the last CREATE transaction of each tracked contract in
 * `<script>/<chainId>/run-latest.json`. Addresses already present in the file are kept,
 * so a local Anvil deploy never wipes a Sepolia address (and vice versa).
 * Nothing to read yet? Warn and exit 0 — this must never break a build.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

type Address = `0x${string}`;

type DeploymentTarget = {
  readonly contractName: string;
  /** Forge script file name, used as the broadcast directory name. */
  readonly script: string;
};

const targets: readonly DeploymentTarget[] = [
  { contractName: "CoffeeTipJar", script: "DeployCoffeeTipJar.s.sol" },
  { contractName: "TodoList", script: "DeployTodoList.s.sol" },
  { contractName: "Crowdfund", script: "DeployCrowdfund.s.sol" },
];

/** Anvil and Sepolia. */
const chainIds: readonly number[] = [31337, 11155111];

/** Broadcast entries created by `new Contract(...)` in a script. */
const createTypes: readonly string[] = ["CREATE", "CREATE2"];

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const broadcastDir = join(repoRoot, "packages", "contracts", "broadcast");
const deploymentsPath = join(repoRoot, "packages", "abi", "src", "deployments.ts");

const label = "deployments:sync";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function isAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

async function readFileOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

/** Last CREATE transaction in a `run-latest.json` that deployed `contractName`. */
function findDeployedAddress(run: unknown, contractName: string): Address | undefined {
  if (!isRecord(run)) return undefined;
  const transactions: unknown = run.transactions;
  if (!Array.isArray(transactions)) return undefined;

  for (let index = transactions.length - 1; index >= 0; index -= 1) {
    const entry: unknown = transactions[index];
    if (!isRecord(entry)) continue;

    const transactionType: unknown = entry.transactionType;
    if (typeof transactionType !== "string" || !createTypes.includes(transactionType)) continue;
    if (entry.contractName !== contractName) continue;

    const address: unknown = entry.contractAddress;
    if (typeof address === "string" && isAddress(address)) return address;
  }

  return undefined;
}

/** Recovers the `chainId: "0x…"` entries already written for one contract. */
function parseExistingAddresses(source: string, contractName: string): Map<number, Address> {
  const found = new Map<number, Address>();
  const blockStart = source.indexOf(`${contractName}: {`);
  if (blockStart === -1) return found;
  const blockEnd = source.indexOf("}", blockStart);
  const block = source.slice(blockStart, blockEnd === -1 ? undefined : blockEnd);

  for (const match of block.matchAll(/(\d+)\s*:\s*"(0x[0-9a-fA-F]{40})"/g)) {
    const rawChainId = match[1];
    const rawAddress = match[2];
    if (rawChainId === undefined || rawAddress === undefined) continue;
    const chainId = Number.parseInt(rawChainId, 10);
    if (!Number.isSafeInteger(chainId) || !isAddress(rawAddress)) continue;
    found.set(chainId, rawAddress);
  }

  return found;
}

function renderDeployments(registry: ReadonlyMap<string, ReadonlyMap<number, Address>>): string {
  const lines: string[] = [
    "// Deployment registry consumed by apps/web through @lab/abi.",
    "// Updated by `bun run deployments:sync` (reads packages/contracts/broadcast).",
    "// Hand edits are fine: chain ids are merged, not replaced.",
    "",
    "export const deployments = {",
  ];

  for (const [contractName, byChain] of registry) {
    lines.push(`  ${contractName}: {`);
    if (byChain.size === 0) {
      lines.push('    // 31337: "0x...",');
    } else {
      const sorted = [...byChain.keys()].sort((a, b) => a - b);
      for (const chainId of sorted) {
        const address = byChain.get(chainId);
        if (address === undefined) continue;
        lines.push(`    ${chainId}: "${address}",`);
      }
    }
    lines.push("  },");
  }

  lines.push(
    "} as const satisfies Record<string, Record<number, `0x${string}`>>;",
    "",
    "export type ContractName = keyof typeof deployments;",
    "",
    "/** Deployed address of `name` on `chainId`, or `undefined` when it is not deployed. */",
    "export function getDeployment(name: ContractName, chainId: number): `0x${string}` | undefined {",
    "  const byChain: Record<number, `0x${string}`> = deployments[name];",
    "  return byChain[chainId];",
    "}",
    "",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const existing = await readFileOrUndefined(deploymentsPath);
  const registry = new Map<string, Map<number, Address>>();
  const missing: string[] = [];
  let resolved = 0;

  for (const target of targets) {
    const byChain =
      existing === undefined
        ? new Map<number, Address>()
        : parseExistingAddresses(existing, target.contractName);

    for (const chainId of chainIds) {
      const runPath = join(broadcastDir, target.script, String(chainId), "run-latest.json");
      const raw = await readFileOrUndefined(runPath);
      if (raw === undefined) {
        missing.push(`${target.script}/${chainId}/run-latest.json`);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn(`${label}  WARNING: ${runPath} is not valid JSON, skipping.`);
        continue;
      }

      const address = findDeployedAddress(parsed, target.contractName);
      if (address === undefined) {
        console.warn(
          `${label}  WARNING: no CREATE transaction for ${target.contractName} on ${chainId}.`,
        );
        continue;
      }

      byChain.set(chainId, address);
      resolved += 1;
      console.log(`${label}  ${target.contractName} @ ${chainId} -> ${address}`);
    }

    registry.set(target.contractName, byChain);
  }

  if (missing.length > 0) {
    console.warn(`${label}  WARNING: no broadcast log for: ${missing.join(", ")}`);
    console.warn(
      `${label}  Expected for a chain you never deployed to. To deploy locally, run` +
        ` \`bun run chain\` in one terminal then \`bun run contracts:deploy\` in another.`,
    );
  }

  if (resolved === 0 && existing !== undefined) {
    console.log(`${label}  no addresses found, packages/abi/src/deployments.ts left untouched.`);
    return;
  }

  // Run the rendered source through Prettier so regenerating an unchanged registry is a no-op
  // instead of a whitespace diff that `bun run format` then reverts. Same reason as sync-abi.ts.
  const output = await format(renderDeployments(registry), {
    ...(await resolveConfig(deploymentsPath)),
    filepath: deploymentsPath,
  });
  if (output === existing) {
    console.log(`${label}  packages/abi/src/deployments.ts already up to date.`);
    return;
  }

  await writeFile(deploymentsPath, output, "utf8");
  console.log(`${label}  wrote packages/abi/src/deployments.ts`);
}

try {
  await main();
} catch (error) {
  // Never fail a build because of the registry sync.
  console.warn(`${label}  WARNING: ${error instanceof Error ? error.message : String(error)}`);
}
