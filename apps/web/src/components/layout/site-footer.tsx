import { localChain } from "@/lib/chains";
import { env } from "@/lib/env";

const links = [
  { label: "Solidity docs", href: "https://docs.soliditylang.org" },
  { label: "Foundry Book", href: "https://book.getfoundry.sh" },
  { label: "wagmi", href: "https://wagmi.sh" },
  { label: "viem", href: "https://viem.sh" },
  { label: "Next.js", href: "https://nextjs.org/docs" },
];

function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium text-foreground">{env.NEXT_PUBLIC_APP_NAME}</span> — you
            write the Solidity, the UI is already wired.
          </p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <p className="font-mono text-xs">
          local chain: {localChain.name} · id {localChain.id} · {env.NEXT_PUBLIC_ANVIL_RPC_URL}
        </p>
      </div>
    </footer>
  );
}

export { SiteFooter };
