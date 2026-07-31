# packages/contracts

The lab's Foundry package: this is where the contracts, the tests and the deploy scripts for every
exercise live.

**Foundry runs on the host.** `forge`, `cast` and `anvil` are native binaries on your PATH; there
are no Docker wrappers or containers involved in building or testing. To install:

```sh
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version   # 1.7.1
```

On this machine `XDG_CONFIG_HOME` points at `~/.config`, so foundryup lives in `~/.config/.foundry`
(binaries in `~/.config/.foundry/bin`, downloaded compilers in `~/.config/.foundry/versions`), and
`~/.zshenv` adds that `bin` to the PATH. If a terminal reports `forge: command not found`, open a
new one or run `source ~/.zshenv`.

## How Foundry is invoked from the repo root

Every `package.json` script runs from the monorepo root and passes `--root packages/contracts` to
Foundry:

```sh
forge build --root packages/contracts
forge test  --root packages/contracts -vvv
```

A few details worth knowing:

- **Relative paths resolve against `--root`** for sources (`src`, `test`, `script`, `lib`), and
  artifacts (`out/`, `cache/`, `broadcast/`) are written inside `packages/contracts`.
- **Exception:** `forge script` resolves the script file path against the **working directory**, not
  against `--root`. Both of these work from the repo root:

  ```sh
  forge script --root packages/contracts DeployCoffeeTipJar --rpc-url anvil --broadcast
  cd packages/contracts && forge script script/01-coffee-tip-jar/DeployCoffeeTipJar.s.sol:DeployCoffeeTipJar --rpc-url anvil --broadcast
  ```

- **Exception:** `forge install` does not accept a **relative** `--root` (it fails with
  `Library directory is not relative to the repository root`). Use an absolute path,
  `cd packages/contracts` first, or go straight to git:
  `git submodule update --init --recursive`.
- **`forge` reads the `.env` of the working directory, not the one under `--root`.** Since
  everything runs from the repo root, the file that matters is the root `.env`
  (`cp .env.example .env`); a `.env` inside `packages/contracts` would be ignored.
- Shell environment variables **do** reach Foundry. Both `FOUNDRY_PROFILE=ci forge test ...` and
  `MINIMUM_TIP=... bun run contracts:deploy` work.
- The deployment private key arrives via `PRIVATE_KEY` (the script calls
  `vm.envUint("PRIVATE_KEY")`). The value in `.env.example` is anvil's account #0
  (`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`), a **publicly known** test
  key: local development only, never send real funds to it. Never put a real key there or in `.env`.

## The local chain

Two ways to run it, same chain (`chainId 31337`, 10 accounts, `127.0.0.1:8545`):

```sh
bun run chain          # native anvil, in the foreground. Leave it in its own terminal.
bun run chain:docker   # optional: the same anvil inside a container
bun run chain:docker:down
```

`bun run chain` runs in the foreground with logs; stop it with `Ctrl+C`. **There is no
`chain:reset`**: anvil persists nothing to disk, so restarting the process already gives you a
clean slate. After every restart you have to **redeploy**, because the previous address is left
without any code.

The root `docker-compose.yml` keeps **only** the `anvil` service, and it is optional. There are no
`forge` or `cast` services on purpose: those are one-shot CLIs, not services. Containerising them
costs you the Solidity LSP in your editor and `forge test --debug`, prevents passing environment
variables from the shell, and forces the `http://anvil:8545` indirection into every RPC URL.

## Commands (always from the repo root)

- `bun run contracts:deps` — installs `forge-std` v1.16.2 as a submodule in `lib/forge-std`.
- `bun run contracts:build` — `forge build`.
- `bun run contracts:test` — `forge test -vvv`.
- `bun run contracts:test:01` / `:02` / `:03` — the same, narrowed to one exercise with
  `--match-path "test/NN-slug/*"`. There is one per exercise; use the one you are working on.
- `bun run contracts:test:watch` — `forge test --watch`, re-runs on save.
- `bun run contracts:coverage` — `forge coverage`.
- `bun run contracts:fmt` — reformats all the Solidity with `forge fmt`.
- `bun run contracts:fmt:check` — fails if the formatting is not canonical (this is what CI runs).
- `bun run contracts:snapshot` — writes `.gas-snapshot` with the gas usage of every test.
- `bun run contracts:deploy` — deploys to anvil and then runs `bun run sync`.
- `bun run chain` / `chain:docker` / `chain:docker:down` — the local chain.
- `bun run sync` — copies ABIs and deployed addresses to `packages/abi`.

For anything without a dedicated script, call Foundry directly:

```sh
forge test --root packages/contracts --match-test test_Withdraw_IsSafeAgainstReentrancy -vvvv
forge test --root packages/contracts --match-path 'test/01-coffee-tip-jar/*'
forge test --root packages/contracts --fuzz-runs 1000        # 1000 runs instead of 256
FOUNDRY_PROFILE=ci forge test --root packages/contracts      # the CI profile
forge build --root packages/contracts --sizes
forge coverage --root packages/contracts
forge test --root packages/contracts --match-test test_Tip_UpdatesAccounting --debug   # debugger
cast chain-id --rpc-url http://127.0.0.1:8545
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://127.0.0.1:8545
```

## Dependencies

`forge-std` is a **git submodule** in `lib/forge-std`, pinned to `v1.16.2`. As a result:

- even though `lib` appears in this package's `.gitignore`, `forge-std` is declared as a submodule in
  the root `.gitmodules` and git tracks it anyway (the gitlink is in the index).
- When cloning the repo: `git clone --recurse-submodules ...`, or if you already cloned it,
  `git submodule update --init --recursive`.
- `foundry.lock` **is committed**: it pins the exact revision (`v1.16.2` →
  `bf647bd6046f2f7da30d0c2bf435e5c76a780c1b`).

What is ignored here: `out/`, `cache/`, `broadcast/` and `docs/`.

## Structure

```text
packages/contracts
├── foundry.toml
├── foundry.lock                          # exact forge-std revision
├── lib/forge-std/                        # v1.16.2 submodule
├── src/01-coffee-tip-jar/
│   ├── ICoffeeTipJar.sol                 # interface + NatSpec (already there)
│   ├── README.md                         # the exercise brief
│   └── CoffeeTipJar.sol                  # <-- YOU implement it (done)
├── src/02-todo-list/
│   ├── ITodoList.sol
│   ├── README.md
│   └── TodoList.sol                      # <-- YOU implement it (done)
├── src/03-crowdfund/
│   ├── ICrowdfund.sol
│   ├── README.md
│   └── Crowdfund.sol                     # <-- exists but empty, YOU implement it
├── test/01-coffee-tip-jar/
│   └── CoffeeTipJar.t.sol                # full suite (31 tests), already there
├── test/02-todo-list/
│   └── TodoList.t.sol                    # full suite (53 tests), already there
├── test/03-crowdfund/
│   └── Crowdfund.t.sol                   # full suite (67 tests), already there
├── script/01-coffee-tip-jar/
│   └── DeployCoffeeTipJar.s.sol          # deployment, already there
├── script/02-todo-list/
│   └── DeployTodoList.s.sol
└── script/03-crowdfund/
    └── DeployCrowdfund.s.sol
```

Convention: one `NN-slug` folder per exercise, with the same name under `src/`, `test/` and
`script/`. Adding one follows [`docs/adding-an-exercise.md`](../../docs/adding-an-exercise.md).

`forge` compiles the whole project, so while any exercise is still a skeleton, `forge build`,
`forge test` and `forge script` are red for **every** exercise — including the ones already
finished. That is the lab's normal state, not a broken checkout.

## What `foundry.toml` configures

- `solc = "0.8.30"` pinned and `evm_version = "cancun"`; optimizer enabled with 200 runs.
- `[fmt]`: `line_length = 120`, 2-space indentation, double quotes, `bracket_spacing = false`,
  `int_types = "long"` (always `uint256`, never `uint`),
  `multiline_func_header = "attributes_first"` and `sort_imports = true`. Write your code in that
  style or let `bun run contracts:fmt` handle it; CI runs `forge fmt --check`.
- `[fuzz] runs = 256` by default. The `ci` profile raises it to 1000 and is used by GitHub Actions,
  which exports `FOUNDRY_PROFILE=ci`. Locally either form works:
  `forge test --root packages/contracts --fuzz-runs 1000` or
  `FOUNDRY_PROFILE=ci forge test --root packages/contracts`.
- `[rpc_endpoints]`: the `anvil` alias is **hardcoded** to `http://127.0.0.1:8545` (it serves both
  `bun run chain` and `bun run chain:docker`), and `sepolia` reads `${SEPOLIA_RPC_URL}` from the
  environment. `[etherscan]` reads `${ETHERSCAN_API_KEY}`.
- `ffi = false` and `fs_permissions` limited to reading `./out`.

## Editor setup — keep "Format Document" and `forge fmt` in agreement

`forge fmt` is the only authority on `*.sol`, and CI enforces it with `forge fmt --check`. The
Solidity extensions do **not** use it by default, so an editor left unconfigured silently writes
code that CI rejects. The two formatters disagree on, among other things, unnamed tuple members:

```solidity
(bool success, ) = _owner.call{value: balance}("");  // prettier-plugin-solidity
(bool success,) = _owner.call{value: balance}("");   // forge fmt  <- the correct one here
```

`.vscode/settings.json` is committed for exactly this reason:

| Setting                              | Value                 | Why                                                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solidity.formatter`                 | `forge`               | Defaults to `prettier` in **both** `JuanBlanco.solidity` and `NomicFoundation.hardhat-solidity`. Same key, so one line fixes whichever is active.                                                                                                     |
| `solidity.monoRepoSupport`           | `true`                | The extension runs `forge fmt --raw -` with the cwd set to the nearest folder holding a `foundry.toml`. Without it the cwd is the repo root, no `foundry.toml` is found, and you get forge's default 4-space indent instead of the 2 configured here. |
| `[solidity].editor.defaultFormatter` | `JuanBlanco.solidity` | Both extensions register a formatter for `solidity`; pin one so the choice is not ambiguous.                                                                                                                                                          |

Requirements and caveats:

- The extension invokes a bare `forge`, so it has to be on the PATH that VS Code itself resolves.
  If formatting silently does nothing, check the Extension Host log — a missing
  `~/.config/.foundry/bin` is the usual cause, and relaunching VS Code from a terminal that has it
  is the quickest fix.
- Format-on-save is deliberately **not** enabled: `forge fmt` refuses to format a file that does not
  parse, which is the normal state of a half-written exercise. If you want it anyway, add
  `"editor.formatOnSave": true` inside the `[solidity]` block.
- Not using VS Code? Point your editor at `forge fmt` rather than at `prettier-plugin-solidity`, or
  just run `bun run contracts:fmt` before committing. `bun run contracts:fmt:check` is the exact
  command CI runs.

## Exercise workflow

1. Read the brief: `src/NN-slug/README.md` (currently `src/03-crowdfund/README.md`).
2. Write your implementation in `src/NN-slug/<Exercise>.sol` (the file already exists, empty, with
   SPDX + pragma + the interface import).
3. Run `bun run contracts:build` and `bun run contracts:test` until everything passes.
4. Run `bun run chain` in another terminal, then `bun run contracts:deploy:NN`. The deployment leaves
   its record in `broadcast/`, and `bun run sync` copies the ABI and the address to `packages/abi`.
5. Run `bun run dev` and try the contract from the UI at
   `http://localhost:3000/exercises/NN-slug`.

## Common problems

- **`forge: command not found`**: your PATH is missing `~/.config/.foundry/bin`. Open a new terminal
  or run `source ~/.zshenv`. If Foundry is not installed:
  `curl -L https://foundry.paradigm.xyz | bash && foundryup`.
- **`forge build` fails with `Contract Crowdfund should be marked as abstract`** (or
  `Member "FEE_BPS" not found`, or `Wrong argument count for function call`): that is
  expected until the implementation is complete. The test suite and the deploy script import the
  contract on purpose (red → green), and the message keeps changing depending on what is still
  missing. Because compilation is project-wide, this also blocks the suites of exercises that are
  already finished.
- **The first build takes ages**: it is downloading solc `0.8.30` into
  `~/.config/.foundry/versions`. It only happens once.
- **`bun run contracts:deps` fails with `Library directory is not relative to the repository root`**:
  `forge install` does not accept a relative `--root`. Use
  `git submodule update --init --recursive`, or
  `forge install --root "$PWD/packages/contracts" foundry-rs/forge-std@v1.16.2`, or
  `cd packages/contracts && forge install foundry-rs/forge-std@v1.16.2`.
- **`bun run contracts:deploy` fails with `Error: No such file or directory (os error 2)`**:
  `forge script` looks for the script file relative to the working directory, not to `--root`. Use
  `forge script --root packages/contracts DeployCoffeeTipJar --rpc-url anvil --broadcast` and then
  `bun run sync`.
- **`--rpc-url anvil` does not connect**: the chain is not running. Start `bun run chain` (or
  `bun run chain:docker`) in another terminal and try again.
- **Port 8545 is already in use**: find out who holds it with `lsof -nP -iTCP:8545 -sTCP:LISTEN`.
  Kill the old `anvil` (`Ctrl+C` in its terminal or `pkill -f anvil`), or run
  `bun run chain:docker:down` if it was the Docker variant.
- **I restarted anvil and MetaMask fails with nonce errors**: the chain is brand new. In MetaMask, go
  to the account settings → "Clear activity tab data", then redeploy.
- **`Cannot connect to the Docker daemon`**: this only affects `bun run chain:docker`. Start
  OrbStack / Docker Desktop, or use `bun run chain` (native), which does not need Docker.
