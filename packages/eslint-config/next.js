import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

import { sharedIgnores } from "./base.js";

/**
 * Flat config for the Next.js App Router app.
 *
 * `eslint-config-next/core-web-vitals` spreads the base Next config (React, React Hooks,
 * @next/next, jsx-a11y, import) and `eslint-config-next/typescript` spreads
 * `typescript-eslint`'s recommended rules — the same rule set `./base.js` provides. Both are
 * taken from `eslint-config-next` here on purpose: ESLint throws when two different plugin
 * objects claim the `@typescript-eslint` namespace, so a single `typescript-eslint` instance
 * must register it.
 */
const nextConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    name: "lab/next-overrides",
    // Must mirror the `files` glob of `eslint-config-next`'s first config object, which is
    // where `react` and `react-hooks` are registered. A config object without `files` applies
    // to every file, including ones those plugins are not registered for (e.g. `.cjs`), and
    // ESLint then throws "could not find plugin react-hooks".
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      // The SSR hydration guard (`useMounted`) sets state in an effect on purpose.
      "react-hooks/set-state-in-effect": "warn",
      // UI copy is plain English prose; escaping every apostrophe hurts readability.
      "react/no-unescaped-entities": "off",
    },
  },
  prettier,
  {
    name: "lab/next-ignores",
    ignores: [...sharedIgnores, "out/**", "build/**", "next-env.d.ts"],
  },
];

export default nextConfig;
