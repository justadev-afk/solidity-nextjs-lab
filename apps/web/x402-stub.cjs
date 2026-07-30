/**
 * Stub for the `@x402/*` packages. Wired up by `turbopack.resolveAlias` in `next.config.ts`.
 *
 * Why it exists: `providers.tsx` imports `@rainbow-me/rainbowkit`, whose barrel pulls in
 * `@wagmi/connectors`' `baseAccount` connector -> `@base-org/account` -> `@coinbase/cdp-sdk`,
 * which imports `@x402/*`. Those are its own OPTIONAL peerDependencies and are not installed
 * (rightly so — x402 is a payment protocol, unrelated to this lab), but Turbopack resolves the
 * specifiers statically at build time and fails with "Module not found".
 *
 * It is CommonJS with a Proxy on purpose, not an empty ESM module: `@coinbase/cdp-sdk`
 * uses both `await import("@x402/...")` and STATIC named imports
 * (e.g. `import {toClientEvmSigner} from "@x402/evm"`). An empty ESM stub makes
 * Turbopack fail with "The export X was not found in module ... The module
 * has no exports at all". With `module.exports = new Proxy(...)` the bundler
 * cannot enumerate the exports statically, so it stops validating them and any
 * name resolves.
 *
 * None of this ever runs in this project: these are x402 payment paths inside
 * the `baseAccount` connector, which we do not use. If one ever did run, it
 * throws an explicit error instead of failing silently.
 */
const notInstalled = (name) => () => {
  throw new Error(
    `@x402/* is not installed (stub at apps/web/x402-stub.cjs). Something tried to use "${String(name)}". ` +
      "If you really do need x402, install @x402/core @x402/evm @x402/svm @x402/extensions " +
      "and delete the turbopack.resolveAlias block from next.config.ts.",
  );
};

module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === "__esModule") return false;
      if (prop === "default") return undefined;
      if (typeof prop === "symbol") return undefined;
      return notInstalled(prop);
    },
    has: () => true,
  },
);
