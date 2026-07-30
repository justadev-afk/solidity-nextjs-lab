/**
 * Prettier owns everything except Solidity — `forge fmt` owns `*.sol`,
 * which is why `*.sol` lives in `.prettierignore`.
 *
 * @type {import("prettier").Config & { tailwindStylesheet?: string }}
 */
const config = {
  semi: true,
  singleQuote: false,
  printWidth: 100,
  tabWidth: 2,
  trailingComma: "all",
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./apps/web/src/app/globals.css",
  overrides: [
    {
      files: ["*.md"],
      options: { proseWrap: "preserve" },
    },
  ],
};

export default config;
