# Exercise 01 — Coffee Tip Jar

A tip jar: anyone can buy you a coffee by sending ETH along with a name and a message that get
stored on chain. Only the owner can empty the jar and change the minimum tip.

This is the useful "hello world" of Solidity: state variables, `msg.sender`/`msg.value`, structs,
dynamic arrays, mappings, events, custom errors, access control and sending ETH.

## Goal

Write the implementation **yourself** until the 31 tests that are already written pass. The
interface, the test suite, the deploy script, the ABI and the Next.js UI all exist already: the
only missing piece is the contract.

> **Important:** `forge build` and `forge test` **fail right now**, and that is the intended
> starting point (red → green). The file already exists, but it is empty, so the compiler complains
> about whatever you have not written yet: first
> `Contract CoffeeTipJar should be marked as abstract` (it does not implement the whole interface),
> and then, as you make progress, things like `Member "MAX_NAME_LENGTH" not found` or
> `Wrong argument count for function call` (the constructor does not take the initial minimum yet).
> The message keeps changing depending on what is missing; it turns green once the implementation is
> complete.

## The file you need to fill in

```text
packages/contracts/src/01-coffee-tip-jar/CoffeeTipJar.sol
```

**It already exists**: it was created empty on purpose so that all you have to do is implement it.
This is the content it starts out with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICoffeeTipJar} from "./ICoffeeTipJar.sol";

contract CoffeeTipJar is ICoffeeTipJar {
    // your code here
}
```

Do not touch `ICoffeeTipJar.sol`, `CoffeeTipJar.t.sol` or `DeployCoffeeTipJar.s.sol`: they are the
spec you are working against. If you change the interface, you will also have to update
`packages/abi/src/coffee-tip-jar.ts` and the UI.

## The interface you must implement

It lives in `ICoffeeTipJar.sol`, fully documented with NatSpec. In summary:

```solidity
struct Tip {
    address from;
    uint256 amount;
    string name;
    string message;
    uint256 timestamp;
}

event TipReceived(address indexed from, uint256 amount, string name, string message, uint256 timestamp);
event Withdrawn(address indexed to, uint256 amount);
event MinimumTipUpdated(uint256 previousMinimum, uint256 newMinimum);

error NotOwner(address caller);
error TipTooSmall(uint256 sent, uint256 minimum);
error NothingToWithdraw();
error WithdrawFailed();
error NameTooLong(uint256 length, uint256 maxLength);
error MessageTooLong(uint256 length, uint256 maxLength);

function owner() external view returns (address);
function minimumTip() external view returns (uint256);
function totalTipped() external view returns (uint256);
function tipCount() external view returns (uint256);
function tipsOf(address supporter) external view returns (uint256);
function getTips() external view returns (Tip[] memory);
function getTip(uint256 index) external view returns (Tip memory);
function tip(string calldata name, string calldata message) external payable;
function withdraw() external;
function setMinimumTip(uint256 newMinimum) external;
```

### Required constants

These go in your contract (not in the interface), public and constant, because the tests read them
as getters (`jar.MAX_NAME_LENGTH()`):

```solidity
uint256 public constant MAX_NAME_LENGTH = 32;
uint256 public constant MAX_MESSAGE_LENGTH = 280;
```

### Constructor

```solidity
constructor(uint256 initialMinimumTip)
```

Sets `owner = msg.sender` and `minimumTip = initialMinimumTip`.

## Behavioural rules

Every rule has its own test in `test/01-coffee-tip-jar/CoffeeTipJar.t.sol`.

1. `tip` reverts with `TipTooSmall(msg.value, minimumTip)` when `msg.value < minimumTip`. Sending
   exactly the minimum **is** valid.
2. `tip` reverts with `NameTooLong(bytes(name).length, MAX_NAME_LENGTH)` if the name exceeds 32
   bytes. Exactly 32 is valid.
3. `tip` reverts with `MessageTooLong(bytes(message).length, MAX_MESSAGE_LENGTH)` if the message
   exceeds 280 bytes. Exactly 280 is valid.
4. An empty `name` is valid: the contract stores `""` and the UI renders it as "Anonymous".
5. On the happy path, `tip` appends a `Tip` to the history, increments `tipCount`, adds to
   `totalTipped` and to `tipsOf(msg.sender)`, and emits
   `TipReceived(msg.sender, msg.value, name, message, block.timestamp)`.
6. `withdraw` is owner-only: for anyone else it reverts with `NotOwner(msg.sender)`.
7. `withdraw` reverts with `NothingToWithdraw()` if `address(this).balance == 0` (including the case
   of calling it twice in a row).
8. `withdraw` sends the **entire** balance to the `owner` with a low-level `call`; if the transfer
   fails, it reverts with `WithdrawFailed()`. It emits `Withdrawn(owner, amount)`. `totalTipped`,
   `tipCount`, `tipsOf` and the history are cumulative: they are **not** reset on withdrawal.
9. `setMinimumTip` is owner-only (`NotOwner` otherwise) and emits
   `MinimumTipUpdated(previous, new)`. `0` is a valid minimum (and then a 0 wei tip is accepted).
10. `getTip(index)` reverts if the index is out of range. The panic from the array access itself
    (`0x32`) is enough; you do not need a custom error.
11. `withdraw` has to be safe against reentrancy: apply the effects **before** the external call
    (checks-effects-interactions pattern). The test is demanding: it checks that the reentrant call
    reverts **with `NothingToWithdraw()`**, meaning the balance is already 0 by the time the owner
    receives the ETH. If you keep the amount to withdraw in a state variable and clear it _after_
    the `call`, the reentrant call fails with `WithdrawFailed()` and the test will tell you.

## Concepts you will practise

- State variables, `immutable` and `constant`: where each thing lives and what it costs.
- `msg.sender` and `msg.value`; `payable` functions.
- `struct`, dynamic arrays in `storage` and `mapping`.
- Events and `indexed`: why the front end lives off them (`useWatchContractEvent`).
- Custom errors (`error` + `revert Foo(...)`) versus `require` with a string: gas and typing.
- Access control: a `modifier` versus an internal check function.
- Sending ETH: low-level `call` versus `transfer`/`send` and the 2300 gas stipend.
- Reentrancy and the checks-effects-interactions pattern.
- `receive` / `fallback`: what happens if someone sends ETH without calling `tip`.
- The cost of storing strings in `storage` and why `getTips()` does not scale.
- `calldata` versus `memory` in parameters.

## Hints

- The minimum state you need: the owner, the minimum, the running total, an array of `Tip` and a
  mapping from address to total contributed.
- `tipCount()` can simply be the length of the array.
- A `mapping(address => uint256) public tipsOf;` generates a getter that already satisfies the
  interface; the same goes for `address public immutable owner;` and `uint256 public minimumTip;`.
  Since Solidity 0.8.8 the `override` keyword is not needed to implement interface functions.
- The "real" length of a string is `bytes(name).length` (those are bytes, not characters: an emoji
  takes several).
- Validate before touching state, and revert with the typed error instead of `require`.
- For `withdraw`: store the balance in a local variable, emit/update whatever you need to update,
  and only then make the external call:
  `(bool ok, ) = owner.call{value: amount}("");`. If `ok` is `false`, `revert WithdrawFailed();`.
- Do not use `payable(owner).transfer(amount)`: the test that forces `WithdrawFailed` and the
  reentrancy one both detect the 2300 gas limit.
- You do not need any reentrancy guard if you order the operations correctly. Think about which
  balance a reentrant call sees.
- The `string` parameters of `tip` are `calldata` in the interface: copy them into the struct as they
  are.

## Commands

All from the repo root. Foundry is installed on the host (`forge --version` → 1.7.1); the details are
in `packages/contracts/README.md`.

```sh
bun run setup               # once: bun install + forge-std v1.16.2
bun run contracts:build     # compile
bun run contracts:test:01   # only this exercise's 31 tests — the one to live in
bun run contracts:test      # the whole lab
bun run contracts:fmt       # forge fmt (CI checks the formatting)
```

Iterating on a single test:

```sh
forge test --root packages/contracts --match-test test_Withdraw_IsSafeAgainstReentrancy -vvvv
forge test --root packages/contracts --match-contract CoffeeTipJarTest --gas-report
forge test --root packages/contracts --match-test test_Tip_UpdatesAccounting --debug
bun run contracts:test:watch   # re-runs the suite every time you save
```

Trying it out on the local chain and in the UI:

```sh
cp .env.example .env                  # once, read by Bun and forge
cp .env.example apps/web/.env.local   # once, for Next.js
nvm use                               # Node 22.16.0; the system one is v16 and won't do
bun run chain                         # anvil on 127.0.0.1:8545 (chain id 31337), another terminal
bun run contracts:deploy              # deploy + bun run sync (ABI and address)
bun run dev                           # http://localhost:3000/exercises/01-coffee-tip-jar
```

A Foundry detail that explains how `contracts:deploy` is written: unlike `forge build`/`forge test`,
**`forge script` resolves the script path against the working directory, not against `--root`**.
That is why the `package.json` script passes the full path
(`packages/contracts/script/...`) even though it already carries `--root packages/contracts`. If you
write the path relative to the root it fails with `Error: No such file or directory (os error 2)`.
These two forms also work, from the repo root:

```sh
forge script --root packages/contracts DeployCoffeeTipJar --rpc-url anvil --broadcast
forge script --root packages/contracts packages/contracts/script/01-coffee-tip-jar/DeployCoffeeTipJar.s.sol:DeployCoffeeTipJar --rpc-url anvil --broadcast
```

## When you are done

- [ ] `bun run contracts:build` compiles with no warnings.
- [ ] `bun run contracts:test` passes 100% (31 tests).
- [ ] `bun run contracts:fmt:check` has nothing to complain about.
- [ ] `FOUNDRY_PROFILE=ci forge test --root packages/contracts` passes too (the 1000 fuzz runs CI
      uses; equivalent to `forge test --root packages/contracts --fuzz-runs 1000`).
- [ ] `forge build --root packages/contracts --sizes` and `bun run contracts:snapshot`: look at the
      contract size and the gas cost of each operation. What is the most expensive one? (spoiler:
      storing strings).
- [ ] `bun run contracts:coverage` to see which branches you are leaving uncovered.
- [ ] You deploy to anvil and the UI shows your tip in the feed without reloading the page.
- [ ] You can explain in one sentence why `withdraw` is safe against reentrancy.
- [ ] You can explain why `totalTipped` does not go down on withdrawal.

## Optional challenges

If you change the interface, remember to update `packages/abi/src/coffee-tip-jar.ts` (or regenerate
it with `bun run sync`) and the UI.

- Add `receive()` to accept bare ETH and record it as an anonymous tip.
- `withdrawTo(address payable to, uint256 amount)` for partial withdrawals.
- Paginate the history: `getTipsPaged(uint256 offset, uint256 limit)`.
- Track who the biggest donor is (`topSupporter`) without iterating the array on every tip.
- Two-step ownership transfer (`transferOwnership` + `acceptOwnership`).
- Measure how much gas you save if the message is only emitted in the event and not stored in
  `storage`. What does the UI lose in exchange?
