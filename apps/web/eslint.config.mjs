import config from "@lab/eslint-config/next";

export default [
  ...config,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];
