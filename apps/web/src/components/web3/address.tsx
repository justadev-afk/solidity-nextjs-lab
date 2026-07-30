"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { shortenAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

type AddressProps = {
  address?: string;
  chars?: number;
  className?: string;
  showCopy?: boolean;
};

export function Address({ address, chars = 4, className, showCopy = true }: AddressProps) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeout.current !== undefined) clearTimeout(timeout.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied to clipboard");
      if (timeout.current !== undefined) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the address");
    }
  }, [address]);

  if (!address) {
    return <span className={cn("font-mono text-xs text-muted-foreground", className)}>—</span>;
  }

  const label = shortenAddress(address, chars);

  if (!showCopy) {
    return (
      <span title={address} className={cn("font-mono text-xs", className)}>
        {label}
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Copy address ${address}`}
            onClick={() => void copy()}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm font-mono text-xs text-foreground/80 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
              className,
            )}
          >
            <span>{label}</span>
            {copied ? (
              <Check className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <Copy className="size-3 shrink-0 opacity-60" aria-hidden="true" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <span className="font-mono text-xs">{address}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
