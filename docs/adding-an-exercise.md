# Adding an exercise

The repeatable playbook for adding exercise `NN` to the lab. Follow it top to bottom and every
exercise ends up shaped the same way.

**How to trigger it:** say _"new exercise: `<name>`"_ (optionally with a one-line description of what
it should teach). Everything else in this document is the standing agreement — number, layout,
naming, verification and the definition of done. Nothing else needs to be specified up front.

> **The one hard rule.** The user writes the implementation contract. Claude creates
> `src/NN-slug/<Contract>.sol` as an **empty skeleton** and stops there. See
> [The hard rule](#the-hard-rule).

---

## 0. Inputs

| Input                      | Who decides                            | Example                            |
| -------------------------- | -------------------------------------- | ---------------------------------- |
| Topic / name               | **The user**                           | "On-Chain Decentralized Todo List" |
| Number `NN`                | Claude — next free number, zero-padded | `02`                               |
| Slug `NN-kebab-case`       | Claude — short, from the name          | `02-todo-list`                     |
| Contract name `PascalCase` | Claude — from the slug                 | `TodoList`                         |
| Interface `I<Contract>`    | Claude                                 | `ITodoList`                        |
| Behavioural spec           | Claude — designed to teach the topic   | 13 rules, 53 tests                 |

If the new exercise takes a number already occupied by a `planned` placeholder in
`apps/web/src/lib/exercises.ts`, **renumber the placeholders** rather than skipping ahead: the
numbering has to stay dense and ordered by difficulty. Renumbering a `planned` entry is free — it
owns no files, only a registry row.

Difficulty ordering matters more than the placeholder list. Slot the new exercise where it belongs
pedagogically and push the rest down.

---

## 1. The hard rule

- **Never write, complete or "fix" `packages/contracts/src/NN-slug/<Contract>.sol`.** It ships as:

  ```solidity
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.30;

  import {IMyExercise} from "./IMyExercise.sol";

  contract MyExercise is IMyExercise {
    // your code here
  }
  ```

  and that is where Claude stops. Treat the file as the user's working copy from that moment on: no
  read-modify-write, no reformat, no "just the missing bit".

- **A failing `forge build` / `forge test` is the correct end state** of adding an exercise. The
  first error is `Contract <Contract> should be marked as abstract`, then it moves as the user makes
  progress (`Member "MAX_FOO" not found`, `Wrong argument count for function call`, …).

- **Foundry compiles the whole project**, so while any exercise is a skeleton, `forge build`,
  `forge test`, `forge script` and therefore `contracts:deploy` are red **for every exercise**,
  including ones that were green before. That is expected; the `web` CI job is the gate for the
  tooling itself. Say so explicitly when handing the exercise over.

Fair game without asking: the interface, the brief, the tests, the deploy script, `@lab/abi`, the
whole frontend, tooling, CI and docs.

---

## 2. File checklist

For slug `NN-my-exercise` and contract `MyExercise`:

| #   | What                        | Path                                                              | Who                    |
| --- | --------------------------- | ----------------------------------------------------------------- | ---------------------- |
| 1   | Interface                   | `packages/contracts/src/NN-my-exercise/IMyExercise.sol`           | Claude                 |
| 2   | Brief (English)             | `packages/contracts/src/NN-my-exercise/README.md`                 | Claude                 |
| 3   | **Implementation skeleton** | `packages/contracts/src/NN-my-exercise/MyExercise.sol`            | Claude → then **USER** |
| 4   | Test suite                  | `packages/contracts/test/NN-my-exercise/MyExercise.t.sol`         | Claude                 |
| 5   | Deploy script               | `packages/contracts/script/NN-my-exercise/DeployMyExercise.s.sol` | Claude                 |
| 6   | ABI module                  | `packages/abi/src/my-exercise.ts`                                 | Claude                 |
| 7   | ABI barrel                  | `packages/abi/src/index.ts`                                       | Claude                 |
| 8   | Address registry            | `packages/abi/src/deployments.ts`                                 | Claude                 |
| 9   | ABI sync target             | `scripts/sync-abi.ts`                                             | Claude                 |
| 10  | Deployment sync target      | `scripts/sync-deployments.ts`                                     | Claude                 |
| 11  | Deploy script entry         | `package.json` (`contracts:deploy:NN`)                            | Claude                 |
| 12  | Address override            | `apps/web/src/lib/env.ts` + `.env.example`                        | Claude                 |
| 13  | Revert copy                 | `apps/web/src/lib/errors.ts`                                      | Claude                 |
| 14  | Route                       | `apps/web/src/app/exercises/NN-my-exercise/page.tsx`              | Claude                 |
| 15  | Client components           | `apps/web/src/app/exercises/NN-my-exercise/_components/*.tsx`     | Claude                 |
| 16  | Data layer                  | `apps/web/src/hooks/use-my-exercise.ts`                           | Claude                 |
| 17  | Registry entry              | `apps/web/src/lib/exercises.ts`                                   | Claude                 |
| 18  | Docs                        | `README.md`, `CLAUDE.md`                                          | Claude                 |

---

## 3. Contracts

### 3.1 Interface — `IMyExercise.sol`

- SPDX MIT, `pragma solidity ^0.8.30;`.
- Full NatSpec: `@title`, `@notice`, `@dev`, `@param`, `@return` on **everything**, struct members
  documented with trailing comments.
- A `@dev` block on the interface itself naming the three places that must not drift: the
  implementation, the test suite and `packages/abi/src/<slug>.ts`.
- Declare the `struct`s, `event`s and `error`s here — the tests reference them as
  `IMyExercise.Foo.selector` and `emit IMyExercise.Bar(...)`.
- **Do not declare the tuning constants.** An interface cannot hold state variables, and
  `MAX_*` values belong to the implementation. The tests read them as getters off the concrete type
  (`instance.MAX_FOO()`), same as exercises 01 and 02.
- Prefer errors with arguments (`ContentTooLong(uint256 length, uint256 maxLength)`) over bare ones:
  they make both the tests and the UI copy sharper.

### 3.2 Brief — `src/NN-my-exercise/README.md`

Written in English, in this order:

1. **Title + two-paragraph pitch.** What it is, and — from exercise 02 onwards — how it differs from
   the previous one. Name the single hard part.
2. **Goal**, with the exact test count, and the red → green warning block (`forge build` and
   `forge test` fail right now, on purpose, and here is the error you will see first).
3. **The file you need to fill in**, with its starting content quoted verbatim.
4. **The interface you must implement**, condensed to a signature block.
5. **Required constants** and **Constructor** (say "there is none" when there is none).
6. **Behavioural rules**, numbered. Every rule maps to at least one test.
7. **Concepts you will practise** — the actual reason the exercise exists.
8. **Hints** — nudges towards the shape of the solution, never the solution.
9. **Commands**, including the per-exercise deploy script and single-test iteration.
10. **When you are done** — a checklist ending in "you can explain X in one sentence".
11. **Optional challenges** — extensions that require touching the interface, the ABI and the UI.

### 3.3 Test suite — `test/NN-my-exercise/MyExercise.t.sol`

- A top-of-file comment saying it does not compile until the implementation exists, and that this is
  the intended starting point.
- Import order matters (`sort_imports = true`): interface, implementation, then `forge-std/Test.sol`.
- Group tests with `// ---` banner comments, one group per rule or family of rules, and name the
  groups after the brief's numbering.
- Cover: constants, the empty state, every revert (with `abi.encodeWithSelector` and the exact
  arguments), every event (`vm.expectEmit(address(instance))`), the happy paths, the boundary values
  (exactly at the limit is valid, one past it is not) and the cross-account isolation.
- Add **fuzz tests** for anything with an arithmetic or structural invariant, and helper contracts
  for anything that needs a contract caller (reentrancy attacker, rejecting receiver, plain
  contract owner).
- Assertion messages are not optional: `assertEq(a, b, "why this must hold")`. They are the fastest
  hint the user gets when they go red.
- Never assert an ordering the interface does not promise.

### 3.4 Deploy script — `script/NN-my-exercise/DeployMyExercise.s.sol`

- Header comment with the two-terminal recipe and where `PRIVATE_KEY` comes from.
- `vm.envUint("PRIVATE_KEY")`, constructor args via `vm.envOr("FOO", DEFAULT)`.
- `vm.startBroadcast(pk)` / `vm.stopBroadcast()`.
- `console2.log` the address and the headline state, then
  `"Next step: run `bun run sync` to refresh packages/abi."`.

### 3.5 Skeleton — `src/NN-my-exercise/MyExercise.sol`

SPDX, pragma, the interface import, `contract MyExercise is IMyExercise { // your code here }`.
**Stop.**

---

## 4. Verifying the tests without writing the implementation

The test suite cannot be compiled inside the repo — the skeleton does not implement the interface.
Shipping an unverified suite is not acceptable, so verify it **outside** the repo:

```sh
SB="$SCRATCHPAD/verify"          # session scratchpad, never the repo
REPO=/path/to/solidity-nextjs-lab

mkdir -p "$SB/src/NN-my-exercise" "$SB/test/NN-my-exercise"
ln -s "$REPO/packages/contracts/lib" "$SB/lib"          # reuse the forge-std submodule
cp "$REPO/packages/contracts/foundry.toml" "$SB/"
cp "$REPO/packages/contracts/src/NN-my-exercise/IMyExercise.sol" "$SB/src/NN-my-exercise/"
cp "$REPO/packages/contracts/test/NN-my-exercise/MyExercise.t.sol" "$SB/test/NN-my-exercise/"

# Throwaway reference implementation — ONLY in the scratchpad, never copied back.
$EDITOR "$SB/src/NN-my-exercise/MyExercise.sol"

cd "$SB" && forge test
FOUNDRY_PROFILE=ci SEPOLIA_RPC_URL="" ETHERSCAN_API_KEY="" forge test   # 1000 fuzz runs
```

This proves three things at once: the suite compiles, the spec is implementable, and every rule in
the brief is actually satisfiable. It also produces the artifact needed for the next step.

**The reference implementation must never reach the repository.** Its only job is to validate the
spec. Do not paste it into a message either — it is the answer to the exercise.

### Generating the hand-written ABI

`packages/abi/src/<slug>.ts` must exist **before** the contract compiles, so the frontend
typechecks. Generate it from the **interface** artifact of the scratch build:

```sh
node -e '
const fs = require("fs");
const abi = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).abi;
fs.writeFileSync(process.argv[2], [
  "// Hand-written to mirror `IMyExercise` exactly, so apps/web typechecks before the exercise",
  "// contract compiles. `bun run abi:sync` overwrites it with the real artifact once the",
  "// implementation exists. If you change IMyExercise.sol, change this file in the same commit.",
  "",
  "export const myExerciseAbi = " + JSON.stringify(abi, null, 2) + " as const;",
  "",
  "export type MyExerciseAbi = typeof myExerciseAbi;",
  "",
].join("\n"));
' "$SB/out/IMyExercise.sol/IMyExercise.json" "$REPO/packages/abi/src/my-exercise.ts"
```

`bun run format` normalises the quotes afterwards. Once the user implements the contract,
`bun run abi:sync` replaces this file with the artifact ABI, which is a superset (it adds the
`MAX_*` getters and the constructor).

---

## 5. Wiring

### 5.1 `packages/abi`

- `src/index.ts`: `export * from "./my-exercise";` **above** the `deployments` export.
- `src/deployments.ts`: add the key with a commented placeholder — `deployments:sync` renders the
  same shape, so the file stays stable:

  ```ts
  MyExercise: {
    // 31337: "0x...",
  },
  ```

### 5.2 `scripts/`

- `sync-abi.ts` → `targets`: `{ artifact: "MyExercise.sol/MyExercise.json", out: "my-exercise.ts", exportName: "myExerciseAbi", typeName: "MyExerciseAbi" }`.
- `sync-deployments.ts` → `targets`: `{ contractName: "MyExercise", script: "DeployMyExercise.s.sol" }`.
  The chain ids (`31337`, `11155111`) are shared by every contract.
- Both scripts are **non-fatal on purpose**: a missing artifact warns and exits 0. Keep it that way.

### 5.3 `package.json`

One script per exercise, plus the aggregate:

```json
"contracts:deploy": "bun run contracts:deploy:01 && bun run contracts:deploy:02 && bun run contracts:deploy:03",
"contracts:deploy:NN": "forge script --root packages/contracts packages/contracts/script/NN-my-exercise/DeployMyExercise.s.sol:DeployMyExercise --rpc-url anvil --broadcast && bun run sync"
```

`forge script` resolves the script path against the **working directory**, not `--root`, which is
why the full path is repeated. Add the new script to `contracts:deploy`, and mirror both into the
command tables in `README.md` and `CLAUDE.md` — those tables are meant to match `package.json`
exactly.

### 5.4 Frontend

- **`lib/env.ts`** — add `NEXT_PUBLIC_MY_EXERCISE_ADDRESS: hexAddress.optional()` to the schema
  **and** the matching `optional(process.env.NEXT_PUBLIC_MY_EXERCISE_ADDRESS)` line. It must be a
  literal static property access so Next can inline it. Add it to `.env.example` too.
- **`lib/errors.ts`** — one `case` per custom error under a `// --- IMyExercise (exercise NN) ---`
  banner. Error names are unique across the lab, so the single switch keeps working.
- **`lib/exercises.ts`** — add the entry with `status: "ready"`, renumbering `planned` entries if
  needed. `planned` cards must not link anywhere.
- **`hooks/use-my-exercise.ts`** — `"use client"`. Mirror the existing hooks: a private
  `useXTarget()` resolving `env override ?? getDeployment(...)`, read hooks built on
  `useReadContract`/`useReadContracts`, a `useStableHandler` + `useWatchContractEvent` per event to
  refetch live, and one `useXWrite()` exposing every mutation plus `hash`/`isPending`/`isConfirming`
  /`isConfirmed`/`error`/`reset`. Parse every contract return value through a `parseX` guard —
  `noUncheckedIndexedAccess` is on and `any` is banned.
  **Never call hooks in a loop**: write the `useWatchContractEvent` calls out one by one.
- **`app/exercises/NN-my-exercise/page.tsx`** — server component. Reads the entry from
  `exercises.ts`, exports `metadata`, renders the header (back link, badges, title with a lucide
  icon, summary, concept badges, the two "contract you implement" / "exercise brief" cards), a
  `<Separator />` and the client app. Copy exercise 01's or 02's page and change the constants.
- **`_components/`** — one `*-app.tsx` orchestrator (`NetworkGuard`, `DeployHint`, layout) plus one
  component per concern. `DeployHint` takes `contractName`, `interfaceName`, `contractPath`,
  `deployScript` and `addressEnvVar`.
- Mirror the on-chain limits as exported constants in the hook and validate the form the same way
  the contract does — `byteLength()` from `lib/format.ts` for anything the contract measures with
  `bytes(s).length`.

---

## 6. Definition of done

```sh
export PATH="$HOME/.config/.foundry/bin:$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"

forge fmt --root packages/contracts --check     # Solidity formatting (CI enforces it)
bun run format:check                            # Prettier owns everything except *.sol
bun run lint                                    # 0 errors
bun run typecheck                               # 0 errors
bun run build                                   # the new route must appear in the route table
forge test --root packages/contracts            # EXPECTED RED: skeleton does not implement the interface
```

Plus, in the scratchpad: the suite green against the reference implementation, on both the default
and the `ci` profile.

`bun run lint` currently ends with **6 warnings, 0 errors** — one
`react-hooks/set-state-in-effect` in `hooks/use-mounted.ts`, three
`react-hooks/incompatible-library` from react-hook-form's `watch()` (`tip-form.tsx`,
`new-task-form.tsx`, `new-campaign-form.tsx`) and two `import/no-anonymous-default-export` in
`eslint.config.mjs` / `postcss.config.mjs`. A form that uses `watch()` adds one more; update the
count in `README.md` and `CLAUDE.md` when it changes rather than "fixing" the warning.

---

## 7. The boilerplate commit

**The scaffolding lands in its own single commit, before the user starts implementing.** The whole
point is that generated boilerplate never mixes into their implementation history: they can diff
their Solidity against a clean baseline, and reset the scaffolding without losing a line of their
own work.

- **One commit, everything in it.** Every file from the [§2 checklist](#2-file-checklist) —
  contracts, brief, tests, deploy script, `@lab/abi`, `scripts/`, `package.json`, frontend,
  `README.md`, `CLAUDE.md`, `docs/` — goes together. Do not split it into "contracts" and
  "frontend".
- **Nothing else in it.** No unrelated refactor and no half-written implementation. A pre-existing
  bug that had to be fixed for the scaffolding to work still goes in, but gets named in the body.
- **Commit, never push.** Pushing needs its own explicit request; "commit this" is not one.
- **Everything in [§6](#6-definition-of-done) must pass first.** A red `forge test` inside the repo
  is expected and does not block the commit; the suite going green in the scratchpad does gate it.
- Work on **`main`** — that is where this repo's history lives. No branch unless asked.
- Message:

  ```text
  feat: exercise NN boilerplate — <Title>
  ```

  Body: what the exercise teaches, the test count, and every repo-wide change the scaffolding
  forced (renumbered `planned` entries, new `package.json` scripts, generalised components, doc
  updates).

### If the user has already started implementing

Perfectly possible — they may have typed a few lines into `<Exercise>.sol` between the handover and
the commit. **Never revert, stash or overwrite their file.** Stage the pristine skeleton for that
one path and leave their edits in the working tree as an unstaged change:

```sh
SKELETON=$(mktemp)
printf '%s\n' \
  '// SPDX-License-Identifier: MIT' \
  'pragma solidity ^0.8.30;' \
  '' \
  'import {IMyExercise} from "./IMyExercise.sol";' \
  '' \
  'contract MyExercise is IMyExercise {' \
  '  // your code here' \
  '}' > "$SKELETON"

# everything except the file the user is editing
git add -A -- . ':!packages/contracts/src/NN-my-exercise/MyExercise.sol'

# stage the skeleton content only in the index — the working tree is untouched
BLOB=$(git hash-object -w "$SKELETON")
git update-index --add --cacheinfo 100644,"$BLOB",packages/contracts/src/NN-my-exercise/MyExercise.sol
```

Verify with `git diff --cached --stat` (skeleton is in) and `git status` (their edits still pending),
then commit. Tell them explicitly that their in-progress lines stayed uncommitted.

---

## 8. Handover message

When the exercise is ready, tell the user:

- where the brief and the interface live;
- the file they have to write, and that it exists and is empty;
- the number of tests waiting for them;
- that the whole Foundry project is red until they implement it — including exercises that were
  green before;
- the commands: `bun run contracts:test`, then `bun run contracts:deploy:NN`, then `bun run dev`.

---

## 9. Gotchas

- **`forge install` cannot take a relative `--root`.** `bun run contracts:deps` fails with
  `Library directory is not relative to the repository root`. Use
  `git submodule update --init --recursive` instead.
- **Never format `*.sol` with Prettier.** `forge fmt` owns Solidity; `*.sol` is in
  `.prettierignore`, and the two disagree (`(bool ok, )` vs `(bool ok,)`).
- **`contracts:fmt` rewrites the user's in-progress contract.** Use `contracts:fmt:check` while they
  are mid-edit.
- **Node 22 is required** (`nvm use`) for anything Node-based; the host default is v16.
- **Interfaces cannot declare constants.** Getters like `MAX_FOO()` live on the concrete contract.
- **Struct field names must survive into the ABI** or viem returns positional tuples and the
  `parseX` guards break. Name every struct member and every event parameter.
- **`deployments:sync` merges chain ids**, so a local deploy never wipes a Sepolia address. Keep it
  that way.
- **Anvil keeps no state on disk.** Every restart needs a redeploy, which re-syncs the address.
