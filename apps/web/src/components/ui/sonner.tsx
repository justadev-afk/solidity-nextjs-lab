"use client";

import type * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

type ToasterTheme = NonNullable<ToasterProps["theme"]>;

function resolveToasterTheme(theme: string | undefined): ToasterTheme {
  return theme === "light" || theme === "dark" ? theme : "system";
}

function Toaster({ theme, ...props }: ToasterProps) {
  const { theme: nextTheme } = useTheme();

  return (
    <Sonner
      theme={theme ?? resolveToasterTheme(nextTheme)}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
