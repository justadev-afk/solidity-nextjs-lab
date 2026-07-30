import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { foundry, sepolia } from "wagmi/chains";

import { env } from "@/lib/env";

export const appName = env.NEXT_PUBLIC_APP_NAME;

const walletConnectProjectId = env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/**
 * Without a WalletConnect project id the lab stays zero-config: only the browser-injected
 * wallet is offered, which is all local Anvil development needs.
 */
const walletGroups = walletConnectProjectId
  ? [
      {
        groupName: "Popular",
        wallets: [metaMaskWallet, rainbowWallet, coinbaseWallet, walletConnectWallet],
      },
      {
        groupName: "Other",
        wallets: [injectedWallet, safeWallet],
      },
    ]
  : [
      {
        groupName: "Installed",
        wallets: [injectedWallet],
      },
    ];

const connectors = connectorsForWallets(walletGroups, {
  appName,
  projectId: walletConnectProjectId ?? "local-dev-no-walletconnect",
});

export const wagmiConfig = createConfig({
  chains: [foundry, sepolia],
  connectors,
  transports: {
    [foundry.id]: http(env.NEXT_PUBLIC_ANVIL_RPC_URL),
    [sepolia.id]: http(env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
