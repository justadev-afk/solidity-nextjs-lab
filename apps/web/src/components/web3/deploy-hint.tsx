import { Terminal } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type DeployHintProps = {
  reason?: "no-address" | "read-failed";
  /** Solidity contract name, e.g. `CoffeeTipJar`. */
  contractName: string;
  /** Interface the implementation has to satisfy, e.g. `ICoffeeTipJar`. */
  interfaceName: string;
  /** Repo-relative path of the file the user writes. */
  contractPath: string;
  /** `bun run` script that deploys this exercise, e.g. `contracts:deploy:01`. */
  deployScript: string;
  /** `NEXT_PUBLIC_*` override that pins the address. */
  addressEnvVar: string;
  className?: string;
};

export function DeployHint({
  reason = "no-address",
  contractName,
  interfaceName,
  contractPath,
  deployScript,
  addressEnvVar,
  className,
}: DeployHintProps) {
  const steps = [
    {
      command: "bun run chain",
      detail:
        "Starts Anvil on http://127.0.0.1:8545 (chain id 31337). Keep it in its own terminal.",
    },
    {
      command: "bun run contracts:deps",
      detail: "Installs forge-std as a git submodule. Only needed the first time.",
    },
    {
      command: "bun run contracts:build",
      detail: `Compiles with solc 0.8.30. Fails until ${contractName}.sol is implemented.`,
    },
    {
      command: `bun run ${deployScript}`,
      detail: "Deploys to Anvil, then syncs the ABI and the address into @lab/abi.",
    },
  ];

  const copy =
    reason === "no-address"
      ? {
          title: `No ${contractName} address for this network`,
          lead: "Nothing is deployed on the chain this app is reading from, so there is no contract to talk to yet.",
        }
      : {
          title: `Could not read the ${contractName} contract`,
          lead: "An address is configured but every call failed — most likely there is no contract at that address on this chain.",
        };

  return (
    <Alert className={cn("border-primary/30", className)}>
      <Terminal className="size-4" aria-hidden="true" />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription className="gap-3">
        <p>{copy.lead}</p>
        <ol className="grid w-full gap-2">
          {steps.map((step, index) => (
            <li key={step.command} className="grid grid-cols-[1.25rem_1fr] items-start gap-x-2">
              <span className="font-mono text-xs text-muted-foreground/70 tabular-nums">
                {index + 1}.
              </span>
              <span className="grid gap-1">
                <code className="w-fit rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                  {step.command}
                </code>
                <span className="text-xs">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs">
          Already have a deployment? Skip the deploy and set{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {addressEnvVar}
          </code>{" "}
          in <code className="font-mono text-xs">apps/web/.env.local</code>, then restart{" "}
          <code className="font-mono text-xs">bun run dev</code>.
        </p>
        <p className="w-full border-t border-border/60 pt-2 text-xs text-foreground">
          First things first: you still have to write{" "}
          <code className="font-mono text-xs">{contractPath}</code> yourself. Steps 3 and 4 keep
          failing until that file implements{" "}
          <code className="font-mono text-xs">{interfaceName}</code>.
        </p>
      </AlertDescription>
    </Alert>
  );
}
