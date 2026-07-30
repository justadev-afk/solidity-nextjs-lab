import { z } from "zod";

/**
 * Public (client-safe) environment. Only `NEXT_PUBLIC_*` variables live here, and they are
 * read as literal static property accesses so Next.js can inline them at build time.
 */

/** Empty or whitespace-only values are treated exactly like a missing variable. */
function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

const hexAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 20-byte hex address (0x + 40 hex characters)")
  .transform((value) => value as `0x${string}`);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Solidity Next.js Lab"),
  NEXT_PUBLIC_ANVIL_RPC_URL: z.url().default("http://127.0.0.1:8545"),
  NEXT_PUBLIC_SEPOLIA_RPC_URL: z.url().optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS: hexAddress.optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_NAME: optional(process.env.NEXT_PUBLIC_APP_NAME),
  NEXT_PUBLIC_ANVIL_RPC_URL: optional(process.env.NEXT_PUBLIC_ANVIL_RPC_URL),
  NEXT_PUBLIC_SEPOLIA_RPC_URL: optional(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: optional(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
  NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS: optional(process.env.NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS),
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Invalid public environment variables (check .env / apps/web/.env.local):\n${details}`,
  );
}

export const env: PublicEnv = parsed.data;
