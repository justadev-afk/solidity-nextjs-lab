# Exercise 03 — Decentralized Crowdfunding Protocol

A funding protocol with no gatekeeper. Anybody opens a campaign by naming an ETH goal and how long
it should run; anybody else backs it with ETH. When the deadline passes the campaign is judged once
and for all: raise at least the goal and the creator takes the money minus a 2% protocol fee, fall
short and every backer pulls their own contribution back, in full and untaxed.

Exercise 01 taught you a contract that holds **its owner's** money. Exercise 02 taught you state
namespaced by `msg.sender`, with no money at all. This one puts the two together and adds the part
that actually hurts: the contract holds **other people's** money, and it has to know, at every
instant, exactly whose. Get one line of ordering wrong in `claimRefund` and a backer contract drains
the campaign from its `receive`.

The new hard part is **safely moving ETH out of a contract that is holding several separate pots at
once** — one per campaign, plus the protocol's own fee — while a derived `enum` decides who is
allowed to touch which.

## Goal

Write the implementation **yourself** until the 70 tests that are already written pass. The
interface, the test suite, the deploy script, the ABI and the Next.js UI all exist already: the only
missing piece is the contract.

> **Important:** `forge build` and `forge test` **fail right now**, and that is the intended starting
> point (red → green). The file already exists, but it holds only its constants, so the compiler
> complains about whatever you have not written yet: first
> `Contract "Crowdfund" should be marked as abstract` (it does not implement the whole interface),
> and then, as you make progress, things like `Member "FEE_BPS" not found` or
> `Wrong argument count for function call`. The message keeps changing depending on what is missing;
> it turns green once the implementation is complete.

## The file you need to fill in

```text
packages/contracts/src/03-crowdfund/Crowdfund.sol
```

**It already exists**: it was created almost empty on purpose so that all you have to do is
implement it. Only the constants come pre-written — their names, types and values are fixed by this
brief and asserted verbatim by the first test, so copying them out would teach you nothing. This is
the content it starts out with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICrowdfund} from "./ICrowdfund.sol";

contract Crowdfund is ICrowdfund {
  uint256 public constant FEE_BPS = 200; // 2%, in basis points
  uint256 public constant BPS_DENOMINATOR = 10_000;
  uint64 public constant MIN_DURATION = 1 hours;
  uint64 public constant MAX_DURATION = 90 days;
  uint256 public constant MAX_TITLE_LENGTH = 80;

  // your code here
}
```

Do not touch `ICrowdfund.sol`, `Crowdfund.t.sol` or `DeployCrowdfund.s.sol`: they are the spec you
are working against. If you change the interface, you will also have to update
`packages/abi/src/crowdfund.ts` and the UI.

## The interface you must implement

It lives in `ICrowdfund.sol`, fully documented with NatSpec. In summary:

```solidity
enum Status { Active, Successful, Failed }

struct Campaign {
    uint256 id;
    address creator;
    uint64 deadline;
    bool claimed;
    string title;
    uint256 goal;
    uint256 pledged;
}

event CampaignCreated(uint256 indexed id, address indexed creator, string title, uint256 goal, uint64 deadline);
event ContributionMade(uint256 indexed id, address indexed contributor, uint256 amount, uint256 pledged);
event FundsClaimed(uint256 indexed id, address indexed creator, uint256 payout, uint256 fee);
event RefundIssued(uint256 indexed id, address indexed contributor, uint256 amount);
event ProtocolFeesWithdrawn(address indexed to, uint256 amount);

error InvalidGoal();
error InvalidDuration(uint256 duration, uint256 minDuration, uint256 maxDuration);
error EmptyTitle();
error TitleTooLong(uint256 length, uint256 maxLength);
error CampaignNotFound(uint256 id);
error InvalidStatus(uint256 id, Status expected, Status actual);
error ZeroContribution();
error NotCampaignCreator(uint256 id, address caller, address creator);
error AlreadyClaimed(uint256 id);
error NothingToRefund(uint256 id, address contributor);
error NotProtocolOwner(address caller, address owner);
error NoFeesToWithdraw();
error TransferFailed(address to, uint256 amount);

function owner() external view returns (address);
function protocolFees() external view returns (uint256);
function campaignCount() external view returns (uint256);
function getCampaign(uint256 id) external view returns (Campaign memory);
function getCampaigns(uint256 offset, uint256 limit) external view returns (Campaign[] memory);
function campaignsOf(address creator) external view returns (uint256[] memory);
function statusOf(uint256 id) external view returns (Status);
function contributionOf(uint256 id, address contributor) external view returns (uint256);
function backerCount(uint256 id) external view returns (uint256);

function createCampaign(string calldata title, uint256 goal, uint64 duration) external returns (uint256 id);
function contribute(uint256 id) external payable;
function claimFunds(uint256 id) external returns (uint256 payout);
function claimRefund(uint256 id) external returns (uint256 amount);
function withdrawProtocolFees() external returns (uint256 amount);
```

### Required constants — already written for you

They live in your contract, not in the interface: an interface cannot hold state variables, and the
tests read them as getters (`crowdfund.FEE_BPS()`). They are already in `Crowdfund.sol`, so this
block is here for reference — do not paste it a second time:

```solidity
uint256 public constant FEE_BPS = 200; // 2%, in basis points
uint256 public constant BPS_DENOMINATOR = 10_000;
uint64 public constant MIN_DURATION = 1 hours;
uint64 public constant MAX_DURATION = 90 days;
uint256 public constant MAX_TITLE_LENGTH = 80;
```

### Constructor

`Crowdfund` takes no constructor arguments. Whoever deploys it becomes `owner()`, and the only thing
that gets them is `withdrawProtocolFees()` — they cannot create, cancel, claim or refund anybody's
campaign. There is no ownership transfer either, so `owner` is a perfect `immutable`.

## Behavioural rules

Every rule has its own test in `test/03-crowdfund/Crowdfund.t.sol`.

1. `createCampaign` reverts with `EmptyTitle()` when `bytes(title).length == 0`, and with
   `TitleTooLong(length, MAX_TITLE_LENGTH)` past 80 bytes. Exactly 80 **is** valid.
2. `createCampaign` reverts with `InvalidGoal()` when `goal == 0`.
3. `createCampaign` reverts with `InvalidDuration(duration, MIN_DURATION, MAX_DURATION)` outside the
   range. **Both bounds are inclusive.**
4. On the happy path, ids start at **0** and increase by one — **globally**, not per address. An id
   is the campaign's position in the registry, so `id == index` and nothing needs a `+1`. Every
   campaign records `creator = msg.sender`, `deadline = block.timestamp + duration`, `pledged = 0`
   and `claimed = false`; the id is appended to `campaignsOf(msg.sender)`; and
   `CampaignCreated(id, msg.sender, title, goal, deadline)` is emitted. There is no per-address cap:
   one account may run any number of campaigns at once.
5. `getCampaign`, `statusOf`, `contributionOf` and `backerCount` revert with `CampaignNotFound(id)`
   for an id that was never handed out: the valid interval is `0 ..= campaignCount() - 1`, so the
   test is `id >= campaignCount()`, not `id > campaignCount()`. Watch the empty registry — id `0` is
   a real campaign as soon as one exists, but out of range while the count is still 0. Every read is
   open to everybody.
6. `statusOf` is **derived, never stored**:
   - `block.timestamp < deadline` → `Active`, **even if the goal has already been met**;
   - otherwise `pledged >= goal` → `Successful`;
   - otherwise → `Failed`.

   The campaign is therefore already over on the deadline second itself. There is no `finalize()`
   to call and no status field to keep in sync.

7. `contribute` reverts with `CampaignNotFound`, with `ZeroContribution()` when `msg.value == 0`,
   and with `InvalidStatus(id, Status.Active, actual)` once the deadline has passed — whether the
   campaign succeeded or failed.
8. `contribute` adds `msg.value` to both `pledged` and `contributionOf(id, msg.sender)`, increments
   `backerCount(id)` **only the first time that address backs this campaign**, and emits
   `ContributionMade(id, msg.sender, msg.value, pledged)` with the total _after_ the contribution.
   Contributions from the same address add up, and there is no cap: a campaign may overshoot.
9. Two campaigns never share a wei. The same address may back both, and each ledger entry is its
   own — that is what the nested mapping buys you.
10. `claimFunds` reverts with `CampaignNotFound`, with
    `NotCampaignCreator(id, msg.sender, creator)` for anybody but the creator (the protocol owner
    included), with `InvalidStatus(id, Status.Successful, actual)` when the campaign is not
    successful, and with `AlreadyClaimed(id)` on a second call.
11. `claimFunds` computes `fee = pledged * FEE_BPS / BPS_DENOMINATOR` and
    `payout = pledged - fee`, adds the fee to `protocolFees()`, sends `payout` to the creator with a
    low-level `call`, emits `FundsClaimed(id, creator, payout, fee)` and returns `payout`. It
    reverts with `TransferFailed(creator, payout)` when the transfer fails — and then **nothing**
    must have changed: not `claimed`, not `protocolFees`. `pledged` is historical and is never
    zeroed.
12. `claimRefund` reverts with `CampaignNotFound`, with
    `InvalidStatus(id, Status.Failed, actual)` while the campaign is active or once it succeeded,
    and with `NothingToRefund(id, msg.sender)` when the caller has nothing staked — because it never
    backed the campaign, or because it already got its money back.
13. `claimRefund` returns the caller's **whole** contribution, zeroes the ledger entry, emits
    `RefundIssued(id, msg.sender, amount)` and returns the amount. A refund is never charged a fee.
    It reverts with `TransferFailed(msg.sender, amount)` when the transfer fails. `pledged` and
    `backerCount` are historical and stay put, so a refund can never flip a campaign back to
    `Active`.
14. `withdrawProtocolFees` reverts with `NotProtocolOwner(msg.sender, owner)` for anybody else and
    with `NoFeesToWithdraw()` when nothing has accrued. It zeroes `protocolFees`, sends the lot to
    the owner, emits `ProtocolFeesWithdrawn(owner, amount)` and returns it, reverting with
    `TransferFailed` if the transfer fails. It must be **impossible** for it to reach a wei that
    still belongs to a campaign.
15. `getCampaigns(offset, limit)` returns a window over the registry in ascending id order. It
    **never reverts**: fewer than `limit` items when the window runs past the end, and an empty
    array when `limit == 0` or `offset >= campaignCount()`. (Deliberately unlike
    `ITodoList.getTasksPaged`, which reverts with `OffsetOutOfRange` — compare the two and decide
    which you would ship.)
16. Both money-moving paths are safe against reentrancy. A creator contract that calls `claimFunds`
    again from its `receive` gets `AlreadyClaimed`; a backer contract that calls `claimRefund` again
    gets `NothingToRefund`. That only holds if the state is written **before** the ETH goes out.

## Concepts you will practise

- `enum` as a **derived** value: how to compute a lifecycle from data you already have instead of
  storing it, and why that removes a whole class of "stale state" bugs.
- Nested mappings, `mapping(uint256 => mapping(address => uint256))`: a ledger per campaign, keyed
  by backer.
- `payable` functions, `msg.value`, and the fact that a contract's balance is a single number
  covering several logically separate pots.
- Sending ETH out with `to.call{value: amount}("")`, checking the boolean, and reverting on failure
  so the bookkeeping never drifts from the balance.
- **Checks-effects-interactions** and the pull-payment pattern — the two ideas that make exercise 03
  a security exercise and not just an accounting one.
- Time as a state machine: `block.timestamp`, an inclusive-or-exclusive deadline boundary, and why
  a contract must never trust the caller for "now".
- Basis-point maths, integer division and rounding: who gets the wei that division throws away.
- Fee accrual as a separate counter instead of "whatever is left in the balance".
- `immutable` versus `constant`, and when an owner needs neither a setter nor a modifier.
- Struct packing again, but with intent: `address` + `uint64` + `bool` is 29 bytes and fits in one
  slot.
- Custom errors carrying an `enum`, and how much better `InvalidStatus(id, expected, actual)` reads
  than three separate errors.

## Hints

- Storage that is enough: a `Campaign[]` (with `id == index`, so `getCampaign` is a bounds check
  away and `campaignCount()` is just its `length`), the nested contribution mapping, a
  `mapping(uint256 => uint256)` of backer counts,
  and a `mapping(address => uint256[])` of ids per creator. `protocolFees` can be a
  `uint256 public` — the auto-generated getter already satisfies the interface.
- Write **one** private helper that turns an id into a storage slot or reverts with
  `CampaignNotFound`, and **one** that computes the status from a `Campaign storage`. Every other
  function is then three lines of guard and two of work.
- Comparing statuses reads best as an early revert:
  `if (status != Status.Active) revert InvalidStatus(id, Status.Active, status);`.
- `block.timestamp` is a `uint256` and the deadline is a `uint64`. Cast once, when you compute the
  deadline; comparing a `uint256` against a `uint64` afterwards is free and safe.
- "First time this address backs this campaign" is just
  `if (_contributions[id][msg.sender] == 0) backers += 1;` — but only if you check it **before** you
  add `msg.value`.
- For the fee, multiply first and divide last: `pledged * FEE_BPS / BPS_DENOMINATOR`. Do it the
  other way round and every campaign under 50 wei pays no fee at all. Then take
  `payout = pledged - fee` rather than computing it independently, so the two can never disagree by
  a wei.
- The transfer helper you want is four lines and is used by all three paths:
  `(bool ok,) = to.call{value: amount}(""); if (!ok) revert TransferFailed(to, amount);`. Note the
  formatting — `forge fmt` writes `(bool ok,)`, Prettier would write `(bool ok, )`, and CI checks
  the former.
- Order matters more than anything else here. In `claimRefund`: read the amount, check it,
  **zero the mapping entry**, emit, and only then call out. In `claimFunds`: set `claimed = true`
  and credit `protocolFees` **before** the call. `test_ClaimRefund_IsSafeAgainstReentrancy` and
  `test_ClaimFunds_IsSafeAgainstReentrancy` exist precisely to catch the other order.
- You do not need a `nonReentrant` modifier or `ReentrancyGuard` for this. Correct ordering is
  enough, and understanding why is the point of the exercise. (Adding one afterwards and measuring
  the gas is a good optional challenge.)
- `withdrawProtocolFees` must read `protocolFees`, not `address(this).balance` — the balance also
  holds every live campaign's money.
- For `getCampaigns`, deal with `offset >= total` first and return `new Campaign[](0)`; then the
  size is just `min(limit, total - offset)`.
- Returning a `storage` dynamic array from an `external view` function copies it to memory for you,
  which is why `campaignsOf` can be a one-liner.

## Commands

All from the repo root. Foundry is installed on the host (`forge --version` → 1.7.1); the details are
in `packages/contracts/README.md`.

```sh
bun run setup               # once: bun install + forge-std v1.16.2
bun run contracts:build     # compile
bun run contracts:test:03   # only this exercise's 70 tests — the one to live in
bun run contracts:test      # the whole lab
bun run contracts:fmt       # forge fmt (CI checks the formatting)
```

Iterating on a single test:

```sh
forge test --root packages/contracts --match-contract CrowdfundTest -vvv
forge test --root packages/contracts --match-test test_ClaimRefund_IsSafeAgainstReentrancy -vvvv
forge test --root packages/contracts --match-test testFuzz_ClaimFunds --fuzz-runs 1000
bun run contracts:test:watch   # re-runs the suite every time you save
```

Trying it out on the local chain and in the UI:

```sh
cp .env.example .env                  # once, read by Bun and forge
cp .env.example apps/web/.env.local   # once, for Next.js
nvm use                               # Node 22.16.0; the system one is v16 and won't do
bun run chain                         # anvil on 127.0.0.1:8545 (chain id 31337), another terminal
bun run contracts:deploy:03           # deploy + bun run sync (ABI and address)
bun run dev                           # http://localhost:3000/exercises/03-crowdfund
```

Anvil mines with real wall-clock timestamps, so a campaign created with `MIN_DURATION` really does
take an hour to expire. To watch a campaign end without waiting, push the chain forward yourself:

```sh
cast rpc evm_increaseTime 3600 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

`bun run contracts:deploy` deploys **every** exercise in one go and then syncs; use it when the
whole `src/` tree compiles. While any exercise is still a skeleton, `contracts:deploy:03` on its own
fails too — `forge script` compiles the entire project before it runs anything.

## When you are done

- [ ] `bun run contracts:build` compiles with no warnings.
- [ ] `bun run contracts:test` passes 100% (70 tests).
- [ ] `bun run contracts:fmt:check` has nothing to complain about.
- [ ] `FOUNDRY_PROFILE=ci forge test --root packages/contracts` passes too (the 1000 fuzz runs CI
      uses; equivalent to `forge test --root packages/contracts --fuzz-runs 1000`).
- [ ] `bun run contracts:coverage` to see which branches you are leaving uncovered.
- [ ] You deploy to anvil and, from three different accounts, run a campaign to a successful claim
      and another one to a refund.
- [ ] You can explain, in one sentence, why `claimRefund` zeroes the mapping entry before it sends
      the ETH and not after.
- [ ] You can explain why `statusOf` is computed instead of stored, and what a `finalize()` function
      would have cost you.
- [ ] You can say where the wei goes when `pledged * 200 / 10_000` does not divide evenly, and
      convince yourself that is the right call.

## Optional challenges

If you change the interface, remember to update `packages/abi/src/crowdfund.ts` (or regenerate it
with `bun run sync`) and the UI.

- Add `cancelCampaign(uint256 id)` so a creator can end an under-funded campaign early and unlock
  refunds. Watch out: `Status` now has a state that time alone cannot derive, so it has to be
  stored. Is it still worth it?
- Let a backer withdraw while the campaign is still `Active`. What does that do to the goal, and to
  the incentive to back early?
- Add a `Milestone` split: release 50% on success and the rest after a second deadline.
- Make the fee configurable by the owner, with a hard cap so it can never become confiscatory. Then
  decide whether a change applies to campaigns that are already running.
- Add `contributeMany(uint256[] calldata ids, uint256[] calldata amounts)` and check that
  `sum(amounts) == msg.value`. Measure the gas against N separate transactions.
- Accept an ERC-20 instead of ETH and watch every `call{value:}` turn into a `transferFrom`, with a
  brand new set of failure modes (fee-on-transfer tokens, tokens that return no boolean).
- Add a `nonReentrant` modifier on top of the correct ordering and measure what the extra `SSTORE`
  costs per call. Was it worth it?
- Cap `campaignsOf` or paginate it: an address with ten thousand campaigns makes that getter
  unusable, and the fix is the same trick as `getCampaigns`.
