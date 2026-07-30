"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/hooks/use-mounted";

type ConnectWalletProps = {
  className?: string;
};

export function ConnectWallet({ className }: ConnectWalletProps) {
  const mounted = useMounted();

  // RainbowKit reads wallet state from the browser, so render a placeholder on the
  // server pass to keep hydration stable.
  if (!mounted) {
    return <Skeleton className={className ?? "h-9 w-36 rounded-xl"} />;
  }

  return (
    <div className={className}>
      <ConnectButton
        accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
        chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
        showBalance={{ smallScreen: false, largeScreen: true }}
      />
    </div>
  );
}
