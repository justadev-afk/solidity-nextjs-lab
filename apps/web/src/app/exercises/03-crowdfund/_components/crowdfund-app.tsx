"use client";

import { Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DeployHint } from "@/components/web3/deploy-hint";
import { NetworkGuard } from "@/components/web3/network-guard";
import { useCrowdfundAddress, useCrowdfundUnavailable } from "@/hooks/use-crowdfund";
import { useMounted } from "@/hooks/use-mounted";
import { useAccount } from "wagmi";

import { CampaignBoard } from "./campaign-board";
import { NewCampaignForm } from "./new-campaign-form";
import { OwnerPanel } from "./owner-panel";
import { ProtocolStats } from "./protocol-stats";

const DEPLOY_HINT = {
  contractName: "Crowdfund",
  interfaceName: "ICrowdfund",
  contractPath: "packages/contracts/src/03-crowdfund/Crowdfund.sol",
  deployScript: "contracts:deploy:03",
  addressEnvVar: "NEXT_PUBLIC_CROWDFUND_ADDRESS",
} as const;

export function CrowdfundApp() {
  const mounted = useMounted();
  const { address } = useCrowdfundAddress();
  const { isConnected } = useAccount();
  const readsUnavailable = useCrowdfundUnavailable();

  return (
    <div className="space-y-6">
      <NetworkGuard />

      {!address ? <DeployHint reason="no-address" {...DEPLOY_HINT} /> : null}
      {readsUnavailable ? <DeployHint reason="read-failed" {...DEPLOY_HINT} /> : null}

      {mounted && !isConnected ? (
        <Alert>
          <Wallet className="size-4" aria-hidden="true" />
          <AlertTitle>Connect a wallet to take part</AlertTitle>
          <AlertDescription>
            The registry is public, so you can read every campaign without a wallet. Creating one,
            backing one, claiming a payout or pulling a refund all need an account — and the three
            roles are worth trying separately. Import at least two Anvil accounts: create a campaign
            with one, back it with the other, then let it expire both ways.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <NewCampaignForm />
        <div className="space-y-6">
          <ProtocolStats />
          <OwnerPanel />
        </div>
        <div className="lg:col-span-2">
          <CampaignBoard />
        </div>
      </div>
    </div>
  );
}
