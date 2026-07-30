# CLAUDE.md

Project instructions for Claude Code sessions in this repository. Read this before writing anything.
Every document in this repo — these instructions, `README.md`, `packages/contracts/README.md` and
the exercise briefs — is written in English.

## 0. Hard rule — the user writes the Solidity implementation contracts

This repo is a practice lab. The whole point is that **the user** implements the contracts.

- **Never create, fill in, complete or "fix" `packages/contracts/src/**/<Exercise>.sol`** — the
  concrete implementation — unless the user explicitly asks for it in that same turn ("write it
  yourself", "give me the solution", "implement it for me").
- Every `src/NN-slug/<Exercise>.sol` is pre-created as an **empty skeleton** — SPDX, `pragma`, the
  interface import and an empty `contract Exercise is IExercise {}` body — so the user can fill it
  in. Treat those files as **the user's working copies**: assume they are editing one right now.
  Never read-modify-write, never reformat, never revert, never append "just the missing bit". If you
  must touch one, ask first.
  - `01-coffee-tip-jar/CoffeeTipJar.sol` — **implemented by the user**, its 31 tests pass.
  - `02-todo-list/TodoList.sol` — **implemented by the user**, its 53 tests pass.
  - `03-crowdfund/Crowdfund.sol` — **still the empty skeleton**, 67 tests waiting.
- `forge build` / `forge test` **failing is the correct starting state**, not a bug to fix. The error
  moves as the user progresses: `Contract Crowdfund should be marked as abstract` while the interface
  is unimplemented, then things like `Member "FEE_BPS" not found` or
  `Wrong argument count for function call` while it is half-written. If asked to "make it compile" or
  "make the tests pass", do **not** write the contract: point at the brief and the failing rule, and
  offer to review, hint or explain.
- **Foundry compiles the whole project**, so an unimplemented skeleton makes `forge build`,
  `forge test`, `forge script` and `contracts:deploy` red for **every** exercise, including ones
  that were green before. That is not a regression in the finished exercises.
- Fair game without asking: the interface (`I<Exercise>.sol`), the exercise brief README, the Foundry
  tests, the deploy script, `@lab/abi`, the whole `apps/web` frontend, tooling, CI, docs.
- Also encouraged: reviewing the user's Solidity, explaining a revert, adding a failing test that
  demonstrates a rule, pointing at gas or reentrancy issues.

## 1. Intent

Practising Solidity from scratch. Exercises are split by path and numbered (`01-`, `02-`, ...).
Each one ships with everything except the implementation, so the loop is red → green:

1. Read the brief (`packages/contracts/src/NN-slug/README.md`) and the interface.
2. The user writes the contract.
3. `bun run contracts:test` until green.
4. `bun run contracts:deploy:NN` — deploys to local anvil and syncs ABI + address into `@lab/abi`.
5. Play with it in the Next.js UI at `/exercises/NN-slug`.

**Adding a new exercise has its own playbook: [`docs/adding-an-exercise.md`](docs/adding-an-exercise.md).**
It is the canonical checklist — number, layout, naming, how to verify a test suite whose
implementation does not exist yet, and the definition of done. Section 7 below is the short version.

Exercise 01 is **Coffee Tip Jar** (`CoffeeTipJar is ICoffeeTipJar`): owner, configurable minimum
tip, a `Tip` struct in a dynamic array, a `tipsOf` mapping, three events, six custom errors, and
`withdraw()` using a low-level `call` with state-then-call ordering. 31 tests in
`test/01-coffee-tip-jar/CoffeeTipJar.t.sol`. **Implemented and green.**

Exercise 02 is **On-Chain Decentralized Todo List** (`TodoList is ITodoList`): no owner and no
admin, one list per address (`mapping(address => Task[])` + an id → index mapping), five events,
five custom errors, O(1) `deleteTask` via swap-and-pop, a bulk `clearCompleted` and a paginated
getter. 53 tests in `test/02-todo-list/TodoList.t.sol`. **Implemented and green.**

Exercise 03 is **Decentralized Crowdfunding Protocol** (`Crowdfund is ICrowdfund`): a shared,
append-only campaign registry with **global** ids, a derived `Status` enum (`Active` / `Successful`
/ `Failed`, computed from `block.timestamp`, `pledged` and `goal` — never stored), a nested
`mapping(uint256 => mapping(address => uint256))` ledger, five events, thirteen custom errors, ETH
in via `payable` and out via low-level `call`, full refunds on failure, a 2% protocol fee accrued to
the deployer on success, and a `getCampaigns` window that clamps instead of reverting. 67 tests in
`test/03-crowdfund/Crowdfund.t.sol`. **Skeleton only — the user is writing it.**

## 2. Tech stack

Reproduced verbatim from the user's original request:

## 🛠️ Tech Stack

- **Smart Contracts:** Solidity, Foundry (Forge/Anvil)
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Shadcn/ui
- **Web3 Integration:** Viem, Wagmi, ConnectKit / RainbowKit
- **Monorepo Tooling:** PNPM Workspaces, Turborepo

### Three deliberate deviations — do not "fix" them

1. **Bun workspaces, not PNPM workspaces.** The user chose Bun as the package manager; Bun ships its
   own workspaces and the two options are mutually exclusive. Turborepo still orchestrates tasks.
   Never run `npm`, `pnpm` or `yarn` here.
2. **RainbowKit, not ConnectKit.** `connectkit@1.9.2` peer-depends on `react: 17.x || 18.x` and this
   stack is on React 19. RainbowKit 2.2.11 supports React 19.
3. **wagmi pinned to 2.x, not 3.x.** RainbowKit 2.2.11 peers on `wagmi ^2.9.0`. Do not bump wagmi to
   3 without also replacing the connect kit.

## 3. Environment facts (verified — do not re-check, do not work around)

- Package manager: **Bun 1.3.14** (`bun install`, `bun run`, `bunx`).
- **Foundry 1.7.1 is installed on the host**, not in Docker. `forge`, `cast`, `anvil` and `chisel`
  are plain binaries on the PATH. Install/upgrade path is
  `curl -L https://foundry.paradigm.xyz | bash && foundryup`.
- Because the user has `XDG_CONFIG_HOME=~/.config`, foundryup lives at **`~/.config/.foundry`** (not
  `~/.foundry`): binaries in `~/.config/.foundry/bin`, downloaded solc in
  `~/.config/.foundry/versions`. `~/.zshenv` contains exactly one relevant line:

  ```sh
  export PATH="$PATH:/Users/juliosansossio/.config/.foundry/bin"
  ```

  A non-interactive shell that misses it (`forge: command not found`) needs
  `source ~/.zshenv`, or prefix commands with
  `export PATH="$HOME/.config/.foundry/bin:$PATH"`.

- There are **no `scripts/forge`, `scripts/cast` or `scripts/anvil` wrappers** — they were deleted.
  `scripts/` holds only `sync-abi.ts` and `sync-deployments.ts`. Never resurrect the wrappers and
  never write `./scripts/forge ...` in docs, comments or commands.
- **Docker is optional.** `docker-compose.yml` has a single service, `anvil`
  (`ghcr.io/foundry-rs/foundry:v1.7.1`, published on `127.0.0.1:8545`, chainId 31337, no named
  volumes), reachable through `bun run chain:docker` / `bun run chain:docker:down`. There are
  deliberately **no `forge`/`cast` services**: they are one-shot CLIs, and containerising them costs
  the editor's Solidity LSP, `forge test --debug`, shell env passthrough
  (`FOUNDRY_PROFILE=ci forge test`), and forces `http://anvil:8545` indirection. Do not add them.
- `packages/contracts/foundry.toml` `[rpc_endpoints]` has `anvil = "http://127.0.0.1:8545"`
  hard-coded (no `${ANVIL_RPC_URL}` indirection) and `sepolia = "${SEPOLIA_RPC_URL}"`, so
  `--rpc-url anvil` works for both `bun run chain` and `bun run chain:docker`.
- The host's default `node` on PATH is **v16.13.0**, too old for Next 16 (`engines.node >= 20.9`).
  The repo pins Node **22.16.0** in `.nvmrc`; **`nvm use` is required** in every new shell before
  `dev`, `build`, `lint` or `typecheck`. Node 22 lives at
  `~/.nvm/versions/node/v22.16.0/bin`. If a Node-based command fails with a syntax/option error,
  suspect this first.
- A working PATH for any command you run here:

  ```sh
  export PATH="$HOME/.config/.foundry/bin:$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
  ```

- `forge-std v1.16.2` is a real git submodule at `packages/contracts/lib/forge-std`
  (`.gitmodules` + `packages/contracts/foundry.lock` pin rev `bf647bd6…`). Fresh clones need
  `git clone --recurse-submodules` or `git submodule update --init --recursive`.
- Env files: `cp .env.example .env && cp .env.example apps/web/.env.local`. The root `.env` is read
  by Bun and by `forge` — Foundry loads `.env` from the **current working directory**, not from
  `--root`, and every script runs from the repo root, so the root `.env` is the one that counts.
  `apps/web/.env.local` is read by Next.js. `docker-compose.yml` interpolates nothing any more.
- `MINIMUM_TIP` (constructor arg, `vm.envOr`) is **not** in `.env.example`; it has to be added by
  hand or passed inline.
- The repo has history and works directly on **`main`**, tracking
  `origin/main` (`git@github.com:justadev-afk/solidity-nextjs-lab.git`). Do not commit or push unless
  asked, and **never push** just because a commit was requested. The one standing exception to "do
  not commit" is the exercise boilerplate commit — see [§7.1](#71-the-boilerplate-commit).

## 4. Locked version matrix

Use these exact versions. **Never `latest`, never `*`.** Do not upgrade anything unprompted.

Root devDependencies:

| Package                       | Version    |
| ----------------------------- | ---------- |
| `turbo`                       | `^2.10.7`  |
| `prettier`                    | `^3.9.6`   |
| `prettier-plugin-tailwindcss` | `^0.8.1`   |
| `typescript`                  | `^5.9.3`   |
| `@types/node`                 | `^22.20.1` |

`apps/web` dependencies:

| Package                     | Version                     |
| --------------------------- | --------------------------- |
| `next`                      | `16.2.12` (exact, no caret) |
| `react`                     | `^19.2.8`                   |
| `react-dom`                 | `^19.2.8`                   |
| `wagmi`                     | `^2.19.5`                   |
| `viem`                      | `^2.55.10`                  |
| `@tanstack/react-query`     | `^5.101.4`                  |
| `@rainbow-me/rainbowkit`    | `^2.2.11`                   |
| `react-hook-form`           | `^7.83.0`                   |
| `zod`                       | `^4.4.3`                    |
| `@hookform/resolvers`       | `^5.5.7`                    |
| `clsx`                      | `^2.1.1`                    |
| `tailwind-merge`            | `^3.6.0`                    |
| `class-variance-authority`  | `^0.7.1`                    |
| `lucide-react`              | `^1.27.0`                   |
| `next-themes`               | `^0.4.6`                    |
| `sonner`                    | `^2.0.7`                    |
| `@radix-ui/react-slot`      | `^1.3.3`                    |
| `@radix-ui/react-label`     | `^2.1.15`                   |
| `@radix-ui/react-separator` | `^1.1.15`                   |
| `@radix-ui/react-tooltip`   | `^1.2.16`                   |
| `@lab/abi`                  | `workspace:*`               |

`apps/web` devDependencies:

| Package                  | Version       |
| ------------------------ | ------------- |
| `@lab/eslint-config`     | `workspace:*` |
| `@lab/typescript-config` | `workspace:*` |
| `@types/react`           | `^19.2.17`    |
| `@types/react-dom`       | `^19.2.3`     |
| `@types/node`            | `^22.20.1`    |
| `typescript`             | `^5.9.3`      |
| `tailwindcss`            | `^4.3.3`      |
| `@tailwindcss/postcss`   | `^4.3.3`      |
| `tw-animate-css`         | `^1.4.0`      |
| `eslint`                 | `^9.39.5`     |
| `eslint-config-next`     | `16.2.12`     |

`packages/eslint-config` dependencies: `eslint ^9.39.5`, `eslint-config-next 16.2.12`,
`typescript-eslint ^8.65.0`, `eslint-config-prettier ^10.1.8`.

Solidity / Foundry:

| Item               | Version                                                         |
| ------------------ | --------------------------------------------------------------- |
| Foundry (host)     | `1.7.1` (`~/.config/.foundry`)                                  |
| solc               | `0.8.30` (`pragma solidity ^0.8.30;`)                           |
| `forge-std`        | `v1.16.2` (git submodule at `packages/contracts/lib/forge-std`) |
| Foundry profile    | `evm_version = "cancun"`, optimizer on, 200 runs                |
| Docker anvil image | `ghcr.io/foundry-rs/foundry:v1.7.1` (optional chain only)       |

## 5. Command table

All from the repo root, via `bun run <script>`. These names are canonical — `README.md` and this
file must stay in sync with `package.json`.

| Script                 | Underlying command                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup`                | `bun install && bun run contracts:deps`                                                                                                                                      |
| `dev`                  | `turbo run dev`                                                                                                                                                              |
| `build`                | `turbo run build`                                                                                                                                                            |
| `lint`                 | `turbo run lint`                                                                                                                                                             |
| `lint:fix`             | `turbo run lint -- --fix`                                                                                                                                                    |
| `typecheck`            | `turbo run typecheck`                                                                                                                                                        |
| `format`               | `prettier --write .`                                                                                                                                                         |
| `format:check`         | `prettier --check .`                                                                                                                                                         |
| `clean`                | `turbo run clean && rm -rf node_modules .turbo`                                                                                                                              |
| `chain`                | `anvil --host 127.0.0.1 --port 8545 --chain-id 31337 --accounts 10 --balance 10000`                                                                                          |
| `chain:docker`         | `docker compose up anvil`                                                                                                                                                    |
| `chain:docker:down`    | `docker compose down`                                                                                                                                                        |
| `contracts:deps`       | `forge install --root packages/contracts foundry-rs/forge-std@v1.16.2`                                                                                                       |
| `contracts:build`      | `forge build --root packages/contracts`                                                                                                                                      |
| `contracts:test`       | `forge test --root packages/contracts -vvv`                                                                                                                                  |
| `contracts:test:watch` | `forge test --root packages/contracts --watch`                                                                                                                               |
| `contracts:coverage`   | `forge coverage --root packages/contracts`                                                                                                                                   |
| `contracts:fmt`        | `forge fmt --root packages/contracts`                                                                                                                                        |
| `contracts:fmt:check`  | `forge fmt --root packages/contracts --check`                                                                                                                                |
| `contracts:snapshot`   | `forge snapshot --root packages/contracts`                                                                                                                                   |
| `contracts:deploy`     | `bun run contracts:deploy:01 && bun run contracts:deploy:02 && bun run contracts:deploy:03` — every exercise, in order                                                       |
| `contracts:deploy:01`  | `forge script --root packages/contracts packages/contracts/script/01-coffee-tip-jar/DeployCoffeeTipJar.s.sol:DeployCoffeeTipJar --rpc-url anvil --broadcast && bun run sync` |
| `contracts:deploy:02`  | `forge script --root packages/contracts packages/contracts/script/02-todo-list/DeployTodoList.s.sol:DeployTodoList --rpc-url anvil --broadcast && bun run sync`              |
| `contracts:deploy:03`  | `forge script --root packages/contracts packages/contracts/script/03-crowdfund/DeployCrowdfund.s.sol:DeployCrowdfund --rpc-url anvil --broadcast && bun run sync`            |
| `abi:sync`             | `bun run scripts/sync-abi.ts`                                                                                                                                                |
| `deployments:sync`     | `bun run scripts/sync-deployments.ts`                                                                                                                                        |
| `sync`                 | `bun run abi:sync && bun run deployments:sync`                                                                                                                               |

Notes that matter when running these:

- **`bun run chain` is a foreground, long-running process.** There is no detached script and no
  `chain:reset`: anvil keeps no state on disk, so restarting the process _is_ the reset. Never block
  a session on it — run it in a separate terminal/background and remember that every restart
  requires a redeploy.
- **`contracts:fmt` rewrites Solidity, including the user's in-progress implementation.** Prefer
  `contracts:fmt:check` while they are mid-edit; only run `contracts:fmt` when asked.
- `contracts:deploy` deliberately does **not** pass `--private-key`. The deploy script reads
  `vm.envUint("PRIVATE_KEY")` from the environment (root `.env` defaults to anvil account #0). Do
  not "improve" this into a shell-interpolated flag — the quoting breaks under `sh`.
- One known defect in `package.json` (**report, do not silently rewrite**, and prefer the workaround
  when you need the command): `contracts:deps` fails with
  `Library directory is not relative to the repository root` because `forge install` cannot take a
  **relative** `--root`. Workarounds: `git submodule update --init --recursive`, or
  `forge install --root "$PWD/packages/contracts" foundry-rs/forge-std@v1.16.2`, or
  `cd packages/contracts && forge install foundry-rs/forge-std@v1.16.2`.
- `forge script` resolves the script path against the **cwd**, not `--root`, which is why every
  `contracts:deploy:NN` repeats the full `packages/contracts/script/...` path even though it already
  passes `--root`. Shortening it to a root-relative path brings back
  `Error: No such file or directory (os error 2)`. Targeting by contract name
  (`forge script --root packages/contracts DeployTodoList --rpc-url anvil --broadcast`) also works.
- Everything else (`build`, `test`, `fmt`, `snapshot`, `coverage`) works fine with the relative
  `--root`.
- `bun run lint` ends with **6 expected warnings, 0 errors**: `react-hooks/set-state-in-effect` in
  `hooks/use-mounted.ts`, `react-hooks/incompatible-library` in `tip-form.tsx`, `new-task-form.tsx`
  and `new-campaign-form.tsx` (react-hook-form's `watch()`), and
  `import/no-anonymous-default-export` in `apps/web/eslint.config.mjs` and `postcss.config.mjs`. Do
  not "fix" them; every new form built on react-hook-form's `watch()` adds one more, so update the
  count instead.

Ad-hoc Foundry commands are run directly, from the repo root with `--root` or from inside
`packages/contracts`:

```sh
forge test --root packages/contracts --match-contract CoffeeTipJarTest -vvvv
forge test --root packages/contracts --fuzz-runs 1000
FOUNDRY_PROFILE=ci forge test --root packages/contracts
cast chain-id --rpc-url http://127.0.0.1:8545
```

## 6. Where things live

- `apps/web` — Next.js 16 App Router. `src/app` routes, `src/components/{layout,ui,web3}`,
  `src/hooks`, `src/lib`. Path alias `@/*` → `./src/*`.
- `apps/web/next.config.ts` + `apps/web/x402-stub.cjs` — the `@x402/*` workaround. `@coinbase/cdp-sdk`
  (reached via RainbowKit → `@wagmi/connectors` `baseAccount` → `@base-org/account`) imports 15
  `@x402/*` specifiers that are its own **optional** peerDependencies and are not installed;
  Turbopack resolves them statically and fails the build, so `turbopack.resolveAlias` maps all 15 to
  the stub. The stub **must stay CommonJS with a `Proxy`**: some of those imports are static named
  imports and an empty ESM module makes Turbopack fail with `The export X was not found`. If a new
  specifier appears, add it to the `x402Specifiers` array.
- `packages/abi` (`@lab/abi`) — hand-written/generated ABIs (`coffee-tip-jar.ts`, `todo-list.ts`,
  `crowdfund.ts`) and the `deployments` address registry. No build step; Next transpiles it via `transpilePackages`.
- `docs/` — long-form procedures kept out of this file. Currently only
  [`adding-an-exercise.md`](docs/adding-an-exercise.md), the canonical playbook for new exercises.
- `packages/contracts` (`@lab/contracts`) — Foundry project. Has only `test`, `fmt` and `clean`
  scripts on purpose: no `build`/`lint`/`typecheck`, so `turbo run build` skips it.
- `packages/eslint-config` (`@lab/eslint-config`) — flat configs, exports `./base` and `./next`. The
  local override object **must** keep `files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"]`, mirroring where
  `eslint-config-next` registers `react`/`react-hooks`; without it ESLint throws "could not find
  plugin react-hooks" on `.cjs` files (e.g. `x402-stub.cjs`).
- `packages/typescript-config` (`@lab/typescript-config`) — `base.json` and `nextjs.json`.
- `scripts/` — only `sync-abi.ts` and `sync-deployments.ts`.
- `bun.lock` is **committed** (CI uses `--frozen-lockfile`). `packages/contracts/lib` is a submodule
  and is not ignored; neither is `packages/contracts/foundry.lock`.
  `packages/contracts/{out,cache,broadcast,docs}` are ignored.

## 7. Adding exercise N — the convention

> **The full playbook lives in [`docs/adding-an-exercise.md`](docs/adding-an-exercise.md)** and is
> the canonical procedure: numbering, the 18-file checklist, what goes in the brief and the test
> suite, **how to verify a test suite whose implementation does not exist yet** (throwaway reference
> implementation in the scratchpad, never in the repo), how to generate the hand-written ABI from
> the interface artifact, and the definition of done. Read it before starting; what follows is the
> summary.
>
> The user's trigger is simply _"new exercise: `<name>`"_ — everything else is already decided in
> that document. If the number collides with a `planned` placeholder in `exercises.ts`, renumber the
> placeholders instead of skipping ahead.

For exercise `NN`, slug `NN-my-exercise`, contract `MyExercise`:

| What                                       | Path                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Interface (Claude writes)                  | `packages/contracts/src/NN-my-exercise/IMyExercise.sol`                        |
| Brief in English (Claude writes)           | `packages/contracts/src/NN-my-exercise/README.md`                              |
| Implementation (USER ONLY, empty skeleton) | `packages/contracts/src/NN-my-exercise/MyExercise.sol`                         |
| Tests                                      | `packages/contracts/test/NN-my-exercise/MyExercise.t.sol`                      |
| Deploy script                              | `packages/contracts/script/NN-my-exercise/DeployMyExercise.s.sol`              |
| ABI module                                 | `packages/abi/src/my-exercise.ts` (re-export from `packages/abi/src/index.ts`) |
| Address registry                           | new key in `deployments` in `packages/abi/src/deployments.ts`                  |
| Route (server component)                   | `apps/web/src/app/exercises/NN-my-exercise/page.tsx`                           |
| Client components                          | `apps/web/src/app/exercises/NN-my-exercise/_components/*.tsx`                  |
| Data layer                                 | `apps/web/src/hooks/use-my-exercise.ts`                                        |
| Registry entry                             | `apps/web/src/lib/exercises.ts`                                                |
| Deploy script entry                        | `contracts:deploy:NN` in `package.json`, added to `contracts:deploy`           |
| Address override                           | `NEXT_PUBLIC_*_ADDRESS` in `apps/web/src/lib/env.ts` + `.env.example`          |
| Revert copy                                | one `case` per custom error in `apps/web/src/lib/errors.ts`                    |

Steps:

1. Write the interface with full NatSpec (`@title`, `@notice`, `@dev`, `@param`, `@return`), SPDX
   MIT, `pragma solidity ^0.8.30;`.
2. Write the brief in English: goal, the file (which already exists, empty), the interface,
   behavioural rules, constants, concepts to learn, commands, and a "when you are done" checklist.
   State explicitly that `forge build`/`forge test` fail until the implementation is complete.
3. Write the Foundry test suite covering every behavioural rule, including fuzz tests and any
   attacker contracts. Add a top-of-file comment noting it will not compile until the user writes
   the implementation.
4. Write the deploy script: `vm.envUint("PRIVATE_KEY")`, constructor args via `vm.envOr(...)`,
   `vm.startBroadcast(pk)` / `vm.stopBroadcast()`, `console2.log` the address.
5. Create `MyExercise.sol` as an **empty skeleton only** — SPDX, `pragma`, the interface import and
   `contract MyExercise is IMyExercise {}` — and **stop**. The user writes the body.
6. Add an entry to the `targets` table in `scripts/sync-abi.ts` (`artifact`, `out`, `exportName`,
   `typeName`) and to the `targets` table in `scripts/sync-deployments.ts` (`contractName`,
   `script`); add the matching `deployments` key. The chain ids read by the deployment sync
   (`31337`, `11155111`) are shared by every contract. Then `bun run abi:sync` and re-export the new
   module from `packages/abi/src/index.ts`.
7. Build the UI route + client components + hook, mirroring exercise 01's or 02's shape. `DeployHint`
   is generic and takes `contractName`, `interfaceName`, `contractPath`, `deployScript` and
   `addressEnvVar`. Never call `useWatchContractEvent` inside a loop — write the calls out one by one.
8. Flip / add the `exercises.ts` entry:

```ts
export const exercises: Exercise[] = [
  // ...
  {
    slug: "NN-my-exercise",
    number: "NN",
    title: "My Exercise",
    summary: "One sentence about what this exercise practises.",
    concepts: ["mappings", "events", "custom errors"],
    status: "ready",
    contractPath: "packages/contracts/src/NN-my-exercise",
    href: "/exercises/NN-my-exercise",
  },
];
```

`status: "planned"` entries render as non-clickable cards and must not link to a route. Currently
planned: `04-erc20-token`, `05-nft-mint`.

Add `NEXT_PUBLIC_MY_EXERCISE_ADDRESS` to `apps/web/src/lib/env.ts` and `.env.example` for a manual
address override. Env vars must be read as literal static `process.env.NEXT_PUBLIC_FOO` property
accesses so Next can inline them — never dynamic indexing.

### 7.1 The boilerplate commit

**The scaffolding of a new exercise goes into its own single commit, made before the user starts
implementing.** The point is that the generated boilerplate never gets mixed into the user's
implementation history: they should be able to `git diff` their own work against a clean baseline,
and to reset the scaffolding without losing a line of their Solidity.

Rules:

- **One commit, everything in it.** Every file from the §7 checklist — contracts, brief, tests,
  deploy script, `@lab/abi`, `scripts/`, `package.json`, frontend, `README.md`, `CLAUDE.md`,
  `docs/` — lands together. Do not split it into "contracts" and "frontend" commits.
- **Nothing else in it.** No unrelated refactor, no half-written implementation, and obviously not
  the user's `<Exercise>.sol` beyond the empty skeleton. If a pre-existing bug has to be fixed to
  make the scaffolding work, say so — it still goes in, but it gets named in the commit body.
- **Commit, never push.** Pushing needs its own explicit request; "commit this" is not one.
- **Before committing**, the definition of done from
  [`docs/adding-an-exercise.md`](docs/adding-an-exercise.md) must pass: `forge fmt --check`,
  `format:check`, `lint`, `typecheck`, `build`, and the suite green in the scratchpad. A red
  `forge test` in the repo is expected and does not block the commit.
- **Message convention**, following `feat: monorepo scaffold + exercise 01 Coffee Tip Jar`:

  ```text
  feat: exercise NN boilerplate — <Title>
  ```

  Body: what the exercise teaches, the test count, and any repo-wide change the scaffolding forced
  (renumbered `planned` entries, new `package.json` scripts, generalised components, doc updates).

- **Working on `main` is fine here** — that is where this repo's history lives. Do not open a branch
  for a boilerplate commit unless asked.

## 8. ABI + deployments sync workflow

```text
forge build   ->  packages/contracts/out/CoffeeTipJar.sol/CoffeeTipJar.json
                    |  bun run abi:sync
                    v
                  packages/abi/src/coffee-tip-jar.ts   (coffeeTipJarAbi, CoffeeTipJarAbi)

forge script  ->  packages/contracts/broadcast/DeployCoffeeTipJar.s.sol/<chainId>/run-latest.json
                    |  bun run deployments:sync
                    v
                  packages/abi/src/deployments.ts      (deployments.CoffeeTipJar[chainId])
```

- `bun run sync` runs both. `bun run contracts:deploy` already chains it.
- Both scripts are **non-fatal**: a missing artifact or broadcast file prints a warning and exits 0,
  because the implementation may not be finished yet. Keep it that way.
- Every `packages/abi/src/<slug>.ts` starts life **hand-written** to match `I<Exercise>` exactly (so
  the frontend typechecks before any contract compiles) and is overwritten by `abi:sync` once the
  real artifact is available — the generated one is a superset, adding the `MAX_*` getters and the
  constructor. The cheapest way to produce the hand-written version is to compile the interface on
  its own in the scratchpad and lift `out/I<Exercise>.sol/I<Exercise>.json`'s `abi`; see
  [`docs/adding-an-exercise.md`](docs/adding-an-exercise.md). If you edit the interface, edit the
  hand-written ABI in the same change.
- `deployments:sync` merges chain ids instead of replacing them, so a local anvil deploy never wipes
  a Sepolia address.
- The frontend resolves an address as
  `env.NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS ?? getDeployment("CoffeeTipJar", chainId)`.
- After restarting anvil the old address holds no code: redeploy, which re-syncs.

## 9. Code quality bar

- TypeScript `strict` + `noUncheckedIndexedAccess`. Guard or `?.` every array index.
- No `any`; use `unknown` plus narrowing. No `@ts-ignore`; `@ts-expect-error` only with a reason.
- `"use client"` on every component that uses wagmi/RainbowKit hooks. Server components must not
  import wagmi.
- Prettier owns JS/TS/CSS/JSON/YAML/MD: double quotes, semicolons, trailing commas, `printWidth`
  100, 2-space indent, trailing newline, `proseWrap: "preserve"` for Markdown. Run `bun run format`
  before finishing (with Node 22 on PATH).
- `forge fmt` owns Solidity (2-space indent, `line_length` 120). `*.sol` is in `.prettierignore`.
  **Never format `*.sol` with Prettier or `prettier-plugin-solidity`** — its output is not
  `forge fmt`'s and CI runs `forge fmt --check`. They differ on unnamed tuple members, among other
  things: prettier writes `(bool success, )`, forge writes `(bool success,)`. `.vscode/settings.json`
  is committed (and un-ignored in `.gitignore`) precisely to pin `"solidity.formatter": "forge"` plus
  `"solidity.monoRepoSupport": true`; both `JuanBlanco.solidity` and
  `NomicFoundation.hardhat-solidity` contribute that key and both default it to `prettier`. The
  monorepo flag is not optional: the extension pipes the buffer through `forge fmt --raw -` with the
  cwd set to the nearest `foundry.toml`, and from the repo root — where there is none — forge falls
  back to a 4-space default. If a `*.sol` diff ever shows only whitespace or `, )` churn, suspect the
  editor formatter before anything else.
- Comments sparse and only where non-obvious. Code identifiers and UI copy in **English**.
- **Documentation language: English, always.** All documentation is written in **English** — every
  `README.md`, every exercise brief, every code comment, and every commit message. No Spanish
  anywhere in the repo. This is a standing rule for every session, not a one-off: never author a new
  file in Spanish, and if you touch a file that still contains Spanish, translate it as part of the
  change.
- shadcn/ui primitives in `src/components/ui` are hand-written in the current canonical form
  (style `new-york`, base color `neutral`, CSS variables, `data-slot` attributes, `cva` for
  `Button`/`Badge`). **Do not run the shadcn CLI** — it needs network and is interactive.
- `@rainbow-me/rainbowkit/styles.css` is imported in `providers.tsx`, not in `globals.css`.
- Before declaring work done: `bun run format:check`, `bun run lint`, `bun run typecheck`, and
  `bun run contracts:test` when Solidity changed (expect a compile failure while the implementation
  is unfinished — that is not a regression).

## 10. CI

`.github/workflows/ci.yml`, two jobs on every push / PR:

- **web** — Bun 1.3.14, `bun install --frozen-lockfile`, then `format:check`, `lint`, `typecheck`,
  `build`.
- **contracts** — checkout with `submodules: recursive`, `foundry-rs/foundry-toolchain@v1` pinned to
  `v1.7.1`, `FOUNDRY_PROFILE=ci` (1000 fuzz runs), `working-directory: packages/contracts` (so no
  `--root` involved). A guard step counts non-interface `.sol` files under
  `packages/contracts/src`; when the count is 0 it skips `forge fmt --check`, `forge build --sizes`
  and `forge test -vvv`. The count is never 0 any more (every exercise skeleton is committed), so
  those steps **do** run and stay red until every implementation is complete — expected while an
  exercise is in progress, and by design: `forge` compiles the whole project, so one unfinished
  skeleton reddens the job even though exercises 01 and 02 are done.

## 11. Security

- **Never commit a real private key.** `.env*` is gitignored except `.env.example`.
- The key in `.env.example` (`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`)
  is **anvil account #0, a publicly known test key**. Local development only; it must never be
  funded or reused anywhere else.
- Never add a private key, RPC secret or API key to `NEXT_PUBLIC_*` — those are inlined into the
  client bundle.
- Deploys to any non-local chain are the user's call. Do not run broadcasting commands against
  Sepolia or mainnet on your own initiative.
