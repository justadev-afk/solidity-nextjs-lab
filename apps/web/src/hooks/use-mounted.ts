"use client";

import { useEffect, useState } from "react";

/** `false` during SSR and the first client render — use it to gate wallet/theme UI. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
