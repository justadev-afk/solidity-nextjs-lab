# solidity-nextjs-lab

Monorepo lab for **practising Solidity from scratch** with a real, modern Web3 frontend.

Every exercise lives in its own numbered folder (`01-`, `02-`, ...) and ships with **everything done
except the contract**: the interface, the brief, the Foundry test suite, the deploy script and the
Next.js UI are already written. The only missing piece is the Solidity implementation, and that one
is on you. The workflow is deliberately red → green: `forge test` fails until your contract exists
and honours the behavioural contract.

Exercise 01: **Coffee Tip Jar** — a tip jar with an `owner`, a configurable minimum, structs,
dynamic arrays, mappings, events, custom errors and fund withdrawal via `call`.

---

## 🛠️ Tech Stack

- **Smart Contracts:** Solidity, Foundry (Forge/Anvil)
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Shadcn/ui
- **Web3 Integration:** Viem, Wagmi, ConnectKit / RainbowKit
- **Monorepo Tooling:** PNPM Workspaces, Turborepo

### Deliberate deviations from the stack above

Three decisions depart from the original list, and it is worth knowing why:

1. **Bun workspaces instead of PNPM workspaces.** The package manager of choice is Bun
   (`bun install`, `bun run`, `bunx`), and Bun ships workspaces of its own: using PNPM's is mutually
   exclusive with that. The layout is identical (`workspaces: ["apps/*", "packages/*"]`); the only
   change is who resolves the dependency tree. Turborepo still orchestrates the tasks.
2. **RainbowKit instead of ConnectKit.** `connectkit@1.9.2` declares a peer of
   `react: 17.x || 18.x`, and this stack runs on **React 19**. RainbowKit 2.2.11 does support
   React 19, so that is the connect kit in use.
3. **wagmi pinned to 2.x, not 3.x.** RainbowKit 2.2.11 declares a `wagmi ^2.9.0` peer. Moving up to
   wagmi 3 would break the kit, so the 2.x line stays pinned on purpose.

### Foundry is installed on the host

`forge`, `cast` and `anvil` run as native binaries from your PATH. There are no Docker wrappers: the
`package.json` scripts call `forge` directly. In exchange you get a working Solidity LSP in the
editor, a usable `forge test --debug`, and `--rpc-url anvil` pointing straight at
`http://127.0.0.1:8545`.

Docker is still in the repo, but **only as an optional alternative for the local chain**
(`bun run chain:docker`). See
[Docker: what it is still doing here](#docker-what-it-is-still-doing-here).

### Host Node: you need `nvm use`

The default `node` on this machine is **v16.13.0**, far too old for Next 16 (which wants `>= 20.9`).
The repo ships a `.nvmrc` with `22.16.0`: run **`nvm use`** in every new terminal before you touch
`bun run dev`, `build`, `lint` or `typecheck`. It is the number one cause of weird errors around
here.

---

## Prerequisites

- **Bun 1.3.14** or newer — the only supported package manager (no npm, no pnpm, no yarn).
- **Foundry 1.7.1** installed on the host:

  ```sh
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```

  The installer adds `forge`, `cast`, `anvil` and `chisel` to your PATH. On this machine
  `XDG_CONFIG_HOME` points at `~/.config`, so foundryup lives in **`~/.config/.foundry`** (not
  `~/.foundry`) and `~/.zshenv` contains:

  ```sh
  export PATH="$PATH:/Users/juliosansossio/.config/.foundry/bin"
  ```

  Verify with `forge --version` (it must report `1.7.1`).

- **Node >= 20.9**, in practice **22.16.0** via `nvm` (`nvm install && nvm use` reads the `.nvmrc`).
  The system `node` is v16 and will not do.
- **Git**, because `forge-std` comes in as a submodule.
- **Docker** with Compose v2+ — **optional**. Only needed if you want the local chain inside a
  container instead of native `anvil` (tested with Docker 29.4.0 and Compose v5.1.2 on OrbStack,
  arm64).

### Key versions

| Piece                  | Version                                      |
| ---------------------- | -------------------------------------------- |
| Bun                    | 1.3.14                                       |
| Node (`.nvmrc`)        | 22.16.0                                      |
| Foundry                | 1.7.1 (host, `~/.config/.foundry`)           |
| solc                   | 0.8.30 (`pragma solidity ^0.8.30;`)          |
| forge-std              | v1.16.2 (submodule)                          |
| Next.js                | 16.2.12 (exact, no caret)                    |
| React / React DOM      | ^19.2.8                                      |
| wagmi                  | ^2.19.5                                      |
| viem                   | ^2.55.10                                     |
| @tanstack/react-query  | ^5.101.4                                     |
| @rainbow-me/rainbowkit | ^2.2.11                                      |
| Tailwind CSS           | ^4.3.3                                       |
| TypeScript             | ^5.9.3                                       |
| Turborepo              | ^2.10.7                                      |
| Prettier               | ^3.9.6                                       |
| ESLint                 | ^9.39.5                                      |
| anvil Docker image     | ghcr.io/foundry-rs/foundry:v1.7.1 (optional) |

The full pinned matrix lives in `CLAUDE.md`. **Do not use `latest` or `*`** when adding
dependencies.

---

## Repo structure

```text
.
├── .editorconfig
├── .env.example
├── .gitignore
├── .gitmodules                              # forge-std -> packages/contracts/lib/forge-std
├── .nvmrc                                   # 22.16.0
├── .prettierignore
├── CLAUDE.md                                # instructions for Claude Code
├── README.md
├── bunfig.toml
├── docker-compose.yml                       # ONLY the anvil service (optional)
├── package.json                             # workspaces + every script
├── prettier.config.mjs
├── turbo.json
├── .github/
│   └── workflows/
│       └── ci.yml                           # job "web" + job "contracts"
├── scripts/
│   ├── sync-abi.ts                          # out/*.json -> packages/abi/src/*.ts
│   └── sync-deployments.ts                  # broadcast/*.json -> deployments.ts
├── apps/
│   └── web/                                 # Next.js 16, App Router
│       ├── components.json                  # shadcn/ui: new-york, neutral, lucide
│       ├── eslint.config.mjs
│       ├── next.config.ts
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       ├── x402-stub.cjs                    # CJS stub for the @x402/* (see Troubleshooting)
│       └── src/
│           ├── app/
│           │   ├── globals.css               # Tailwind v4 + "coffee" theme in oklch
│           │   ├── layout.tsx
│           │   ├── page.tsx                  # lab index
│           │   ├── providers.tsx             # wagmi + react-query + RainbowKit + themes
│           │   └── exercises/
│           │       └── 01-coffee-tip-jar/
│           │           ├── page.tsx          # server component (metadata + header)
│           │           └── _components/
│           │               ├── coffee-tip-jar-app.tsx
│           │               ├── jar-stats.tsx
│           │               ├── tip-form.tsx
│           │               ├── tips-feed.tsx
│           │               └── owner-panel.tsx
│           ├── components/
│           │   ├── layout/
│           │   │   ├── site-header.tsx
│           │   │   └── site-footer.tsx
│           │   ├── theme-provider.tsx
│           │   ├── theme-toggle.tsx
│           │   ├── ui/                       # hand-written shadcn/ui
│           │   │   ├── alert.tsx
│           │   │   ├── badge.tsx
│           │   │   ├── button.tsx
│           │   │   ├── card.tsx
│           │   │   ├── input.tsx
│           │   │   ├── label.tsx
│           │   │   ├── separator.tsx
│           │   │   ├── skeleton.tsx
│           │   │   ├── sonner.tsx
│           │   │   ├── textarea.tsx
│           │   │   └── tooltip.tsx
│           │   └── web3/
│           │       ├── address.tsx
│           │       ├── connect-wallet.tsx
│           │       ├── deploy-hint.tsx
│           │       ├── network-guard.tsx
│           │       └── tx-status.tsx
│           ├── hooks/
│           │   ├── use-coffee-tip-jar.ts     # exercise 01 data layer
│           │   └── use-mounted.ts
│           └── lib/
│               ├── chains.ts                 # foundry (31337) + sepolia
│               ├── env.ts                    # NEXT_PUBLIC_* validated with zod
│               ├── errors.ts                 # decodes viem reverts
│               ├── exercises.ts              # exercise registry
│               ├── format.ts
│               ├── utils.ts                  # cn()
│               └── wagmi.ts                  # wagmiConfig + connectors
└── packages/
    ├── abi/                                  # @lab/abi
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── deployments.ts                # addresses by chainId
    │       └── coffee-tip-jar.ts             # coffeeTipJarAbi
    ├── contracts/                            # @lab/contracts (Foundry)
    │   ├── .gitignore
    │   ├── README.md
    │   ├── foundry.lock                      # exact forge-std revision
    │   ├── foundry.toml
    │   ├── package.json
    │   ├── lib/
    │   │   └── forge-std/                    # v1.16.2 submodule
    │   ├── src/
    │   │   └── 01-coffee-tip-jar/
    │   │       ├── ICoffeeTipJar.sol         # interface (already written)
    │   │       ├── README.md                 # exercise brief
    │   │       └── CoffeeTipJar.sol          # <- YOU WRITE THIS (exists, empty)
    │   ├── test/
    │   │   └── 01-coffee-tip-jar/
    │   │       └── CoffeeTipJar.t.sol
    │   └── script/
    │       └── 01-coffee-tip-jar/
    │           └── DeployCoffeeTipJar.s.sol
    ├── eslint-config/                        # @lab/eslint-config (base.js, next.js)
    │   ├── package.json
    │   ├── base.js
    │   └── next.js
    └── typescript-config/                    # @lab/typescript-config
        ├── package.json
        ├── base.json
        └── nextjs.json
```

`bun.lock` **is committed** (CI runs `bun install --frozen-lockfile`). `packages/contracts/lib` is
the `forge-std` submodule and is not ignored either, same as `packages/contracts/foundry.lock`.

`CoffeeTipJar.sol` **already exists**, but only as a skeleton: SPDX, `pragma`, the interface import
and `contract CoffeeTipJar is ICoffeeTipJar {}`. Filling it in is the exercise.

---

## Quick start

```bash
# 0. Clone with submodules (forge-std). If you already cloned without them:
#    git submodule update --init --recursive
git clone --recurse-submodules <url> solidity-nextjs-lab
cd solidity-nextjs-lab

# 1. The right Node (the system one is v16 and no good for Next 16)
nvm install && nvm use

# 2. JS dependencies + forge-std v1.16.2
bun run setup

# 3. Environment variables: one copy for forge/Bun, another for Next
cp .env.example .env
cp .env.example apps/web/.env.local

# 4. Local chain, in its own terminal (native anvil, chainId 31337, 10 accounts)
bun run chain

# 5. YOUR TURN: implement the contract (the file already exists, empty)
#    packages/contracts/src/01-coffee-tip-jar/CoffeeTipJar.sol
#    Full brief: packages/contracts/src/01-coffee-tip-jar/README.md
#    Interface to implement: .../ICoffeeTipJar.sol

# 6. Red -> green
bun run contracts:build
bun run contracts:test

# 7. Deploy to anvil and sync ABI + address into @lab/abi
bun run contracts:deploy

# 8. Start the frontend (another terminal, with `nvm use` already done)
bun run dev   # http://localhost:3000
```

Before step 5, `bun run contracts:build` and `bun run contracts:test` **fail on purpose**: the
skeleton does not implement the interface. That is the lab's starting line, not a breakage.

The frontend starts fine without a deployed contract: the exercise page renders a `<DeployHint />`
listing the missing steps, plus the option of setting `NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS` in
`apps/web/.env.local` if you already have a deployment.

> If step 2 fails with `Library directory is not relative to the repository root`, don't worry: the
> submodule already came in with `git clone --recurse-submodules`, so `bun install` is enough. See
> [Troubleshooting](#troubleshooting).

### Connecting the wallet

Everything here is **100% simulated**: anvil is an in-memory chain, the ETH is worthless and the
keys below are public. There is no faucet, no login and no sign-up anywhere.

**No WalletConnect account is needed.** If `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is empty, the app
only offers the injected connector, so you need a **browser extension** (Rabby, MetaMask, Frame).
None of them asks for an email or a sign-up; the password they do ask for is local, to encrypt the
keystore on your disk. Mobile wallets and anything going through WalletConnect **will not appear**
in the modal until you fill in the projectId — at that point MetaMask, Rainbow, Coinbase Wallet,
WalletConnect and Safe are added.

> Rabby is a particularly good fit for this lab: it simulates the transaction before you sign and
> **decodes the revert reason**, so you see `TipTooSmall(sent, minimum)` or `NotOwner(caller)` with
> their arguments instead of a generic "transaction may fail".

#### 1. Add the network

| Field    | Value                   |
| -------- | ----------------------- |
| Name     | Anvil                   |
| RPC URL  | `http://127.0.0.1:8545` |
| Chain ID | `31337`                 |
| Symbol   | `ETH`                   |

#### 2. Import **these two** Anvil accounts

They come from anvil's default mnemonic (`test test … junk`), so each one starts with 10,000 ETH. In
the wallet: _Import private key_.

```
# Account #0 — the OWNER of the jar (it is the one that deploys the contract)
address  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
key      0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Account #1 — just some visitor, for testing access control
address  0x70997970C51812dc3A010C7d01b50e0d17dc79C8
key      0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

> [!WARNING]
> These keys are **publicly known** (they are in the Foundry documentation and in this README). For
> the local chain only: never send real funds to them and never use them on a public testnet.

Import **both**, not just one. Switching accounts in the wallet is what lets you verify access
control: #0 is the `owner` and sees the Owner Panel with the withdraw button; #1 does not, and if it
tried to withdraw it would get `NotOwner(caller)`. With a single account you never get to exercise
`withdraw()`, `NotOwner()` or `NothingToWithdraw()`.

#### 3. What to try in the UI

Each action exercises a different branch of your contract:

| UI action                     | Branch it exercises                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Tip with the ☕ 0.001 preset  | happy path: `push`, `tipCount++`, `TipReceived` → the feed updates via `useWatchContractEvent`   |
| Tip of `0.0001`               | `TipTooSmall(sent, minimum)`                                                                     |
| Empty name                    | `""` is stored and the feed renders it as **Anonymous**                                          |
| Message longer than 280 chars | `MessageTooLong` (the form blocks it earlier with zod; paste a long text to force the revert)    |
| Connected as #1               | the Owner Panel disappears (`useIsOwner()`)                                                      |
| Connected as #0 → Withdraw    | `Withdrawn`, the balance drops to 0 and `totalTipped` is **not** reset, because it is cumulative |
| Withdraw a second time        | `NothingToWithdraw()`                                                                            |

That last pair is the best proof that your `withdraw()` is correct.

#### 4. If the wallet says "Gas balance is not enough"

It means the connected account holds **0 ETH on the local chain**, almost always because you are
connected with your personal account instead of an anvil one. Two ways out:

- **Switch to account #0 or #1**, the ones you just imported (they already hold 10,000 ETH). This is
  the recommended route.
- **Or print yourself fake ETH at your own address**, if you would rather keep using it:

  ```bash
  cast rpc anvil_setBalance 0xYOUR_ADDRESS 0x21e19e0c9bab2400000 \
    --rpc-url http://127.0.0.1:8545
  ```

  That hex value is 10,000 ETH. The catch: your address will not be the `owner`, so the Owner Panel
  stays hidden.

You can also take gas out of the equation by starting the chain with
`anvil --gas-price 0 --base-fee 0`, but you will still need a balance for the tip's `msg.value`:
funding the account is unavoidable.

#### 5. Anvil cheats

Because the chain is simulated, you can fake the state at will. Very handy for exercising the UI:

```bash
RPC=http://127.0.0.1:8545

# print ETH at any address
cast rpc anvil_setBalance 0xADDR 0x21e19e0c9bab2400000 --rpc-url $RPC
# send transactions as any address, without holding its key
cast rpc anvil_impersonateAccount 0xADDR --rpc-url $RPC
# travel through time (the `timestamp` field of every tip)
cast rpc evm_setNextBlockTimestamp 1800000000 --rpc-url $RPC
# mine blocks by hand
cast rpc anvil_mine 10 --rpc-url $RPC
# wipe the whole chain and start over
cast rpc anvil_reset --rpc-url $RPC
```

`anvil_impersonateAccount` is the most useful one: it lets you fill the feed with different senders
without importing ten keys into the wallet.

To seed some sample tips from the terminal, bypassing the UI:

```bash
JAR=$(grep -oE '0x[0-9a-fA-F]{40}' packages/abi/src/deployments.ts | head -1)
cast send "$JAR" "tip(string,string)" "Alice" "Great exercise" \
  --value 0.01ether \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
  --rpc-url http://127.0.0.1:8545
```

---

## Environment variables

`cp .env.example .env` and `cp .env.example apps/web/.env.local`. They are two copies of the same
file with different purposes:

- **`.env` (root)** — loaded by **Bun** (on any `bun run`) and by **`forge`**. Mind this detail:
  Foundry reads the `.env` of the **working directory**, not the one under `--root`. Since every
  script is launched from the repo root, the file that counts is the one at the root; a `.env`
  inside `packages/contracts` would be ignored.
- **`apps/web/.env.local`** — read by **Next.js**. Only the `NEXT_PUBLIC_*` keys matter.

`docker-compose.yml` no longer interpolates anything: the `anvil` service needs no variables.

| Variable                               | What it is for                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`                 | Display name of the app. Defaults to `Solidity Next.js Lab`.                            |
| `NEXT_PUBLIC_ANVIL_RPC_URL`            | RPC of the local chain. Defaults to `http://127.0.0.1:8545`.                            |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL`          | Sepolia RPC. Optional; empty = no dedicated transport.                                  |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional. Empty = injected connector only.                                              |
| `NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS`   | Pins the contract address and bypasses the deployment registry.                         |
| `PRIVATE_KEY`                          | Key that signs deployments (`vm.envUint`). Defaults to anvil account #0.                |
| `SEPOLIA_RPC_URL`                      | Sepolia RPC for `forge script` and the `sepolia` alias in `foundry.toml`.               |
| `ETHERSCAN_API_KEY`                    | Contract verification on Etherscan.                                                     |
| `MINIMUM_TIP`                          | Optional, **not in `.env.example`**: initial minimum in wei. Defaults to `0.001 ether`. |

Variables without the `NEXT_PUBLIC_` prefix never reach the browser bundle: `forge` reads them from
the process environment. To change `MINIMUM_TIP`, add it by hand to the root `.env` (or pass it
inline: `MINIMUM_TIP=100000000000000 bun run contracts:deploy`); if it is absent, the deploy script
falls back to its default.

> **Security:** the private key in `.env.example`
> (`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`) is anvil account #0 and is
> **publicly known**. It is good for local development only. Never send real funds to it and never
> commit a real private key — `.env*` is in `.gitignore` except for `.env.example`.

---

## Scripts

They all run from the repo root with `bun run <script>`. The table mirrors `package.json` exactly.

### Web development

| Script         | What it does                                                             |
| -------------- | ------------------------------------------------------------------------ |
| `setup`        | `bun install && bun run contracts:deps`. The full cold start.            |
| `dev`          | `turbo run dev`. Next 16 with Turbopack on `http://localhost:3000`.      |
| `build`        | `turbo run build`.                                                       |
| `lint`         | `turbo run lint` (ESLint 9, flat config).                                |
| `lint:fix`     | `turbo run lint -- --fix`.                                               |
| `typecheck`    | `turbo run typecheck` (`tsc --noEmit` in `apps/web` and `packages/abi`). |
| `format`       | `prettier --write .`.                                                    |
| `format:check` | `prettier --check .`. This is what CI runs.                              |
| `clean`        | `turbo run clean && rm -rf node_modules .turbo`.                         |

`bun run lint` finishes with **4 expected warnings** (0 errors): `react-hooks/set-state-in-effect`
in `hooks/use-mounted.ts` (the hydration guard sets state inside an effect on purpose),
`react-hooks/incompatible-library` in `tip-form.tsx` because of react-hook-form's `watch()`, and two
`import/no-anonymous-default-export` in `apps/web/eslint.config.mjs` and `postcss.config.mjs`. None
of them are errors and none of them break CI.

### Local chain

| Script              | What it does                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `chain`             | `anvil --host 127.0.0.1 --port 8545 --chain-id 31337 --accounts 10 --balance 10000`. In the foreground. |
| `chain:docker`      | `docker compose up anvil`. The same chain, containerized, same port.                                    |
| `chain:docker:down` | `docker compose down`. Docker variant only.                                                             |

`bun run chain` runs in the foreground with logs: leave it in its own terminal and stop it with
`Ctrl+C`. To restart the chain from scratch, just kill it and launch it again — anvil keeps no state
on disk, so there are no volumes and no `chain:reset` to clean up. After every restart you have to
**deploy again**.

Anvil mines instantly (the default behaviour). If you want to see _pending_ states in the UI, add
`--block-time 2` to `bun run chain` (or to the `command` of the `anvil` service in
`docker-compose.yml`).

### Contracts (Foundry on the host)

| Script                 | What it does                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts:deps`       | `forge install --root packages/contracts foundry-rs/forge-std@v1.16.2`.                                                                                    |
| `contracts:build`      | `forge build --root packages/contracts`.                                                                                                                   |
| `contracts:test`       | `forge test --root packages/contracts -vvv`.                                                                                                               |
| `contracts:test:watch` | `forge test --root packages/contracts --watch`. Re-runs on save.                                                                                           |
| `contracts:coverage`   | `forge coverage --root packages/contracts`.                                                                                                                |
| `contracts:fmt`        | `forge fmt --root packages/contracts`. `forge fmt` is the authority on Solidity, not Prettier.                                                             |
| `contracts:fmt:check`  | `forge fmt --root packages/contracts --check`.                                                                                                             |
| `contracts:snapshot`   | `forge snapshot --root packages/contracts`. Gas snapshot.                                                                                                  |
| `contracts:deploy`     | `forge script --root packages/contracts script/01-coffee-tip-jar/DeployCoffeeTipJar.s.sol:DeployCoffeeTipJar --rpc-url anvil --broadcast && bun run sync`. |

The `anvil` alias used by `--rpc-url` comes from `[rpc_endpoints]` in
`packages/contracts/foundry.toml` and resolves to `http://127.0.0.1:8545`, so it works the same with
`bun run chain` as with `bun run chain:docker`.

`contracts:deploy` does not pass `--private-key` on the command line: the script reads
`vm.envUint("PRIVATE_KEY")` from the environment (the root `.env` ships anvil account #0). That
sidesteps shell quoting problems.

For anything without a script of its own, call Foundry directly — from the root with `--root`, or by
stepping into the package:

```bash
forge build --root packages/contracts --sizes
forge test --root packages/contracts --match-test test_Withdraw_IsSafeAgainstReentrancy -vvvv
forge test --root packages/contracts --fuzz-runs 1000
FOUNDRY_PROFILE=ci forge test --root packages/contracts        # the profile CI uses
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://127.0.0.1:8545
cast chain-id --rpc-url http://127.0.0.1:8545
```

Unlike the previous Docker setup, shell environment variables **do** reach `forge`
(`FOUNDRY_PROFILE=ci forge test ...` works) and the editor's Solidity LSP sees the same installation
as the command line.

### Syncing with `@lab/abi`

| Script             | What it does                                                                            |
| ------------------ | --------------------------------------------------------------------------------------- |
| `abi:sync`         | `bun run scripts/sync-abi.ts`. Copies the `.abi` from `out/` into `packages/abi/src/`.  |
| `deployments:sync` | `bun run scripts/sync-deployments.ts`. Reads `broadcast/` and updates `deployments.ts`. |
| `sync`             | Both of the above, in order.                                                            |

Neither one breaks the build: if the artifact or the `broadcast` entry is missing, they warn and
exit with code 0.

---

## Docker: what it is still doing here

`docker-compose.yml` keeps **a single service**, `anvil`, published on `127.0.0.1:8545` with chainId
`31337`. It is an optional alternative to `bun run chain`, handy when:

- you want the chain isolated from the host, or want to stop and start it without worrying about
  stray processes;
- you are on a machine with no Foundry installed and only need the node;
- you want to reproduce anvil `v1.7.1` exactly, regardless of your own `foundryup`.

```bash
bun run chain:docker        # start (foreground)
bun run chain:docker:down   # stop
```

**There are no `forge` or `cast` services, and that is deliberate.** `forge` and `cast` are not
services: they are one-shot CLIs. Putting them in a container costs more than it gives:

- the editor loses the Solidity LSP, because the compiler and the dependencies live inside the
  container;
- `forge test --debug` (the interactive debugger) stops being usable;
- the container cannot reach the host's `localhost`, so every RPC URL has to go through the
  `http://anvil:8545` indirection, and `foundry.toml` ends up full of variables just for that;
- shell environment variables do not cross into the container (`FOUNDRY_PROFILE=ci forge test` does
  nothing);
- and named cache volumes do not fit either: mounting a volume on a path that does not exist in the
  image creates it as `root:root`, while the image runs with uid 1000 (user `foundry`), which ends
  in `Permission denied (os error 13)`.

With Foundry on the host all of that goes away, and `bun run chain:docker` is still there for anyone
who wants a containerized node.

---

## Adding a new exercise

Convention for exercise `NN` with slug `NN-my-exercise` and contract `MyExercise`:

1. **Interface + brief** (these two _are_ written up front):
   - `packages/contracts/src/NN-my-exercise/IMyExercise.sol` — interface with full NatSpec, SPDX
     MIT.
   - `packages/contracts/src/NN-my-exercise/README.md` — the brief, in English: goal, behavioural
     rules, constants, concepts and a "when you're done" checklist.
2. **Tests**: `packages/contracts/test/NN-my-exercise/MyExercise.t.sol`, importing
   `../../src/NN-my-exercise/MyExercise.sol`. They must cover every rule in the brief and fail
   until the implementation exists.
3. **Deployment**: `packages/contracts/script/NN-my-exercise/DeployMyExercise.s.sol`, reading
   `vm.envUint("PRIVATE_KEY")` and the constructor parameters with `vm.envOr(...)`.
4. **Implementation**: `packages/contracts/src/NN-my-exercise/MyExercise.sol` — created **empty**
   (SPDX + pragma + import + `contract MyExercise is IMyExercise {}`) and **you write it**. That
   is the exercise.
5. **ABI**: add an entry to the `targets` table in `scripts/sync-abi.ts` with `artifact`
   `"MyExercise.sol/MyExercise.json"`, `out` `"my-exercise.ts"`, `exportName` `"miEjercicioAbi"`
   and `typeName` `"MyExerciseAbi"`; run `bun run abi:sync` and re-export the new module from
   `packages/abi/src/index.ts`.
6. **Deployments**: add an entry to the `targets` table in `scripts/sync-deployments.ts`
   (`contractName: "MyExercise"`, `script: "DeployMyExercise.s.sol"`) and the key
   `MyExercise: {}` to the `deployments` object in `packages/abi/src/deployments.ts`. The chainIds
   being looked up (`31337` and `11155111`) are shared by every contract.
7. **Frontend**:
   - Route: `apps/web/src/app/exercises/NN-my-exercise/page.tsx` (server component, with
     `metadata`).
   - Client components: `apps/web/src/app/exercises/NN-my-exercise/_components/*.tsx`.
   - Data layer: `apps/web/src/hooks/use-my-exercise.ts`.
   - If it needs an address override, add `NEXT_PUBLIC_MI_EJERCICIO_ADDRESS` to
     `apps/web/src/lib/env.ts` and to `.env.example`.
8. **Registry**: in `apps/web/src/lib/exercises.ts`, move the entry from `status: "planned"` to
   `"ready"` (or add it) so the lab index links to it:

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

Entries with `status: "planned"` render as non-clickable cards. Right now there are three:
`02-crowdfund`, `03-erc20-token` and `04-nft-mint`.

To close the loop: `bun run contracts:test`, `bun run contracts:deploy` (which already calls
`bun run sync`), `bun run typecheck` and `bun run lint`.

---

## Troubleshooting

**`node: bad option` / Next refuses to start / odd syntax errors coming from tooling.**
The `node` on your PATH is v16.13.0 and `package.json` requires `>= 20.9`. Run `nvm use` (it reads
`.nvmrc` → 22.16.0) in that terminal and try again. It happens every time you open a new tab.

**`forge: command not found` (or `anvil`, or `cast`).**
Foundry is installed in `~/.config/.foundry/bin` and the PATH is exported from `~/.zshenv`. Open a
new terminal, or in the current one: `source ~/.zshenv`. Check with `forge --version` → `1.7.1`. If
it is not installed: `curl -L https://foundry.paradigm.xyz | bash && foundryup`.

**`bun run contracts:build` fails with `Contract CoffeeTipJar should be marked as abstract`** (or
`Member "MAX_NAME_LENGTH" not found`, or `Wrong argument count for function call`).
This is the expected **red** state: `CoffeeTipJar.sol` exists but does not implement the whole
`ICoffeeTipJar` interface yet, nor the constants the tests expect. The message keeps changing as you
make progress; it turns green once the implementation is complete. Brief in
`packages/contracts/src/01-coffee-tip-jar/README.md`.

**Port 8545 is already taken.**
Find out who holds it with `lsof -nP -iTCP:8545 -sTCP:LISTEN`. If it is an earlier `anvil`, kill it
(`Ctrl+C` in its terminal, or `pkill -f anvil`). If it is the Docker variant,
`bun run chain:docker:down`. If it is some unrelated process, start anvil on another port
(`anvil --port 8546 ...`) and update `NEXT_PUBLIC_ANVIL_RPC_URL` and the `anvil` alias in
`packages/contracts/foundry.toml`.

**The wallet says `Gas balance is not enough for transaction` and won't let you sign.**
The connected account holds 0 ETH on the local chain: nine times out of ten it is your personal
account instead of an anvil one. Switch to the imported account #0 or #1, or print yourself a
balance with
`cast rpc anvil_setBalance 0xYOUR_ADDRESS 0x21e19e0c9bab2400000 --rpc-url http://127.0.0.1:8545`.
Full detail in [Connecting the wallet](#connecting-the-wallet). Note: the dollar value the wallet
shows on a local chain means nothing, ignore it.

**I don't see the Owner Panel / the withdraw button.**
It only shows up if the connected account is the `owner`, and the `owner` is whoever deployed the
contract: anvil account #0 (`0xf39Fd6e5…2266`). Switch to that account in the wallet. The contract
pins it in the constructor, so if you deploy from a different key, the `owner` will be that other
one.

**I restarted the chain and MetaMask reports nonce errors or phantom balances.**
Every anvil start is a brand-new chain, and the wallet keeps the old history. In MetaMask:
Settings → Advanced → **Clear activity tab data** (or "Reset account") for the anvil network. In
Rabby: the address → _Clear pending transactions_. You also have to **deploy again**
(`bun run contracts:deploy`), because the previous address no longer holds any code.

**`bun run contracts:deps` fails with `Library directory is not relative to the repository root`.**
`forge install` does not accept a relative `--root` (it needs to resolve the `lib/` prefix against
the git repository root). Quick way out: the submodule already comes in with
`git clone --recurse-submodules`, or install it with git:

```bash
git submodule update --init --recursive
```

If you really want Foundry to do it, give it an absolute path or step into the package:

```bash
forge install --root "$PWD/packages/contracts" foundry-rs/forge-std@v1.16.2
# or
cd packages/contracts && forge install foundry-rs/forge-std@v1.16.2
```

**`bun run contracts:deploy` fails with `Error: No such file or directory (os error 2)`.**
`forge script` resolves the script path against the **working directory**, not against `--root`.
From the repo root:

```bash
forge script --root packages/contracts DeployCoffeeTipJar --rpc-url anvil --broadcast && bun run sync
# or, equivalently:
cd packages/contracts && forge script script/01-coffee-tip-jar/DeployCoffeeTipJar.s.sol:DeployCoffeeTipJar --rpc-url anvil --broadcast
cd - && bun run sync
```

**The UI can't find the contract even though anvil is up.**
Three causes, in order of likelihood: (1) you haven't deployed since the last chain restart; (2) the
wallet is on another network — `<NetworkGuard />` offers a button to switch to Anvil;
(3) `NEXT_PUBLIC_COFFEE_TIP_JAR_ADDRESS` points at a stale address: clear it and let the `@lab/abi`
registry resolve the address.

**I changed the contract and the frontend still uses the old ABI.** `bun run sync` (or just
`bun run contracts:deploy`, which chains it). The `@lab/abi` package has no build step; Next
transpiles it via `transpilePackages`, but you have to restart `bun run dev` if the change is not
picked up.

**You cloned the repo and `forge-std` is missing.**
`git submodule update --init --recursive`.

**The first contract compilation takes forever.**
It is downloading solc `0.8.30`. It is cached in `~/.config/.foundry/versions`, so it only happens
once per machine.

**`bun run build` fails resolving `@x402/*` packages.**
It shouldn't, because a workaround is already in place: `@coinbase/cdp-sdk` (reached via
RainbowKit → `@wagmi/connectors` `baseAccount` → `@base-org/account`) imports 15 `@x402/*`
specifiers that are **its own optional peerDependencies** and are not installed. Turbopack resolves
them statically and breaks the build, so `apps/web/next.config.ts` redirects all of them to
`apps/web/x402-stub.cjs`. The stub is **CommonJS with a `Proxy`** on purpose: some of those imports
are static and named, and with an empty ESM module Turbopack fails with
`The export X was not found`. If the error comes back, check that the `x402Specifiers` list in
`next.config.ts` covers the new specifier.

---

## Code conventions

- TypeScript in `strict` mode with `noUncheckedIndexedAccess`: no `any`, no `@ts-ignore`.
- Prettier is the authority on JS/TS/CSS/MD/JSON/YAML: double quotes, semicolons, trailing commas,
  `printWidth` 100, 2-space indentation. Run `bun run format` before committing.
- Solidity is formatted by **`forge fmt`** (2-space indentation, `line_length` 120). `*.sol` is in
  `.prettierignore` on purpose. The committed `.vscode/settings.json` sets
  `"solidity.formatter": "forge"` so the editor's _Format Document_ produces the same bytes as
  `forge fmt --check`, which is what CI enforces — the extensions default to
  `prettier-plugin-solidity`, which disagrees (`(bool success, )` vs `(bool success,)`). See
  [`packages/contracts/README.md`](packages/contracts/README.md#editor-setup--keep-format-document-and-forge-fmt-in-agreement).
- Components that use wagmi hooks are marked `"use client"`. Server components never import wagmi.
- Code identifiers, UI copy and documentation are all in **English**, exercise briefs included.
- The primitives in `components/ui/` are hand-written shadcn/ui (`new-york` style, `neutral` base,
  `lucide` icons). The shadcn CLI is not used.

## CI

`.github/workflows/ci.yml` runs on every `push` and `pull_request`, with two jobs:

- **web** — Bun 1.3.14, `bun install --frozen-lockfile`, then `format:check`, `lint`, `typecheck`
  and `build`.
- **contracts** — checkout with submodules, `foundry-rs/foundry-toolchain@v1` pinned to `v1.7.1`,
  `FOUNDRY_PROFILE=ci` (1000 fuzz runs) and `working-directory: packages/contracts`, so `--root` is
  not used there. A guard step counts the non-interface `.sol` files under
  `packages/contracts/src`: if there are none, it prints a notice and skips `forge fmt --check`,
  `forge build --sizes` and `forge test -vvv`. As soon as the implementation file exists, CI starts
  requiring it to compile, be formatted and pass the tests.
