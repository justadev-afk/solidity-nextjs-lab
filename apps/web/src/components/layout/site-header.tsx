import Link from "next/link";
import { Coffee } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectWallet } from "@/components/web3/connect-wallet";
import { env } from "@/lib/env";

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Coffee className="size-4" />
          </span>
          <span className="hidden sm:inline">{env.NEXT_PUBLIC_APP_NAME}</span>
          <span className="sm:hidden">Lab</span>
        </Link>

        <nav className="ml-2 flex items-center text-sm">
          <Link
            href="/#exercises"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Exercises
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}

export { SiteHeader };
