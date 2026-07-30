"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { type ReactNode, useMemo, useState } from "react";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { foundry } from "wagmi/chains";

import { appName, wagmiConfig } from "@/lib/wagmi";

const rainbowKitTheme = {
  lightMode: lightTheme({
    accentColor: "#6f4b32",
    accentColorForeground: "#fdfaf6",
    borderRadius: "medium",
    fontStack: "system",
    overlayBlur: "small",
  }),
  darkMode: darkTheme({
    accentColor: "#e3b183",
    accentColorForeground: "#241a12",
    borderRadius: "medium",
    fontStack: "system",
    overlayBlur: "small",
  }),
};

type ProvidersProps = {
  children: ReactNode;
  /** Raw `Cookie` header, forwarded by the root layout so wagmi can rehydrate on the server. */
  cookie?: string | null;
};

function Providers({ children, cookie }: ProvidersProps) {
  // One QueryClient per request/browser session — never share it across requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const initialState = useMemo(() => cookieToInitialState(wagmiConfig, cookie), [cookie]);

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={foundry}
          appInfo={{ appName }}
          theme={rainbowKitTheme}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { Providers };
