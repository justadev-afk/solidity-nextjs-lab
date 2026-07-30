"use client";

import { DeployHint } from "@/components/web3/deploy-hint";
import { NetworkGuard } from "@/components/web3/network-guard";
import { useCoffeeTipJarAddress, useJarStats } from "@/hooks/use-coffee-tip-jar";

import { JarStats } from "./jar-stats";
import { OwnerPanel } from "./owner-panel";
import { TipForm } from "./tip-form";
import { TipsFeed } from "./tips-feed";

const DEPLOY_HINT = {
  contractName: "CoffeeTipJar",
  interfaceName: "ICoffeeTipJar",
  contractPath: "packages/contracts/src/01-coffee-tip-jar/CoffeeTipJar.sol",
  deployScript: "contracts:deploy:01",
  addressEnvVar: "NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS",
} as const;

export function CoffeeTipJarApp() {
  const { address } = useCoffeeTipJarAddress();
  const { owner, isLoading } = useJarStats();

  // An address that resolves but never answers a read usually means the contract is not
  // deployed there (or the wallet is pointed at another chain).
  const readsUnavailable = Boolean(address) && !isLoading && owner === undefined;

  return (
    <div className="space-y-6">
      <NetworkGuard />

      {!address ? <DeployHint reason="no-address" {...DEPLOY_HINT} /> : null}
      {readsUnavailable ? <DeployHint reason="read-failed" {...DEPLOY_HINT} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <TipForm />
        <div className="space-y-6">
          <JarStats />
          <OwnerPanel />
        </div>
        <div className="lg:col-span-2">
          <TipsFeed />
        </div>
      </div>
    </div>
  );
}
