import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

/** Paths that no ESLint run in this monorepo should ever look at. */
export const sharedIgnores = ["node_modules/**", "dist/**", ".next/**", ".turbo/**"];

/** Flat config shared by every plain TypeScript package in the monorepo. */
const baseConfig = [
  { name: "lab/ignores", ignores: sharedIgnores },
  ...tseslint.configs.recommended,
  prettier,
];

export default baseConfig;
