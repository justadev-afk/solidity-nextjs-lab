import type { NextConfig } from "next";

/**
 * `@x402/*` specifiers that `@coinbase/cdp-sdk` imports dynamically. They are
 * optional peerDependencies of it and are not installed; Turbopack still tries
 * to resolve them at build time and fails, so they are redirected to an empty
 * stub. See the long comment in `./x402-stub.cjs` for the full dependency chain.
 */
const X402_STUB = "./x402-stub.cjs";
const x402Specifiers = [
  "@x402/core/client",
  "@x402/core/server",
  "@x402/evm",
  "@x402/evm/batch-settlement/client",
  "@x402/evm/exact/client",
  "@x402/evm/exact/server",
  "@x402/evm/exact/v1/client",
  "@x402/evm/upto/client",
  "@x402/evm/upto/server",
  "@x402/express",
  "@x402/extensions/bazaar",
  "@x402/fetch",
  "@x402/svm/exact/client",
  "@x402/svm/exact/server",
  "@x402/svm/exact/v1/client",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lab/abi"],
  turbopack: {
    resolveAlias: Object.fromEntries(x402Specifiers.map((id) => [id, X402_STUB])),
  },
};

export default nextConfig;
