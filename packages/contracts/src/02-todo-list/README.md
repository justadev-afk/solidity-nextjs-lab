# Exercise 02 — On-Chain Decentralized Todo List

A todo list with no owner and no admin. Every address keeps **its own** list of tasks: it can create,
rewrite, check, uncheck and delete them, and nobody else can touch them. Reads are open to everyone,
because a public chain has no secrets anyway.

Where exercise 01 taught you access control with a single privileged `owner`, this one teaches the
other half of the story: **namespacing state by `msg.sender`**. There is no modifier to write and no
role to check — the ownership rule falls out of the data layout. Every read takes an explicit
`owner` argument, every write acts implicitly on `msg.sender`, and because there is no
`deleteTaskOf(address,uint256)` in the interface, no caller can ever reach into somebody else's
list.

The new hard part is **deleting from a dynamic array in O(1)** without losing track of anything.

## Goal

Write the implementation **yourself** until the 53 tests that are already written pass. The
interface, the test suite, the deploy script, the ABI and the Next.js UI all exist already: the only
missing piece is the contract.

> **Important:** `forge build` and `forge test` **fail right now**, and that is the intended starting
> point (red → green). The file already exists, but it is empty, so the compiler complains about
> whatever you have not written yet: first
> `Contract TodoList should be marked as abstract` (it does not implement the whole interface), and
> then, as you make progress, things like `Member "MAX_CONTENT_LENGTH" not found`. The message keeps
> changing depending on what is missing; it turns green once the implementation is complete.

## The file you need to fill in

```text
packages/contracts/src/02-todo-list/TodoList.sol
```

**It already exists**: it was created empty on purpose so that all you have to do is implement it.
This is the content it starts out with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ITodoList} from "./ITodoList.sol";

contract TodoList is ITodoList {
  // your code here
}
```

Do not touch `ITodoList.sol`, `TodoList.t.sol` or `DeployTodoList.s.sol`: they are the spec you are
working against. If you change the interface, you will also have to update
`packages/abi/src/todo-list.ts` and the UI.

## The interface you must implement

It lives in `ITodoList.sol`, fully documented with NatSpec. In summary:

```solidity
struct Task {
    uint256 id;
    string content;
    bool completed;
    uint64 createdAt;
    uint64 updatedAt;
}

event TaskCreated(address indexed owner, uint256 indexed id, string content, uint64 createdAt);
event TaskUpdated(address indexed owner, uint256 indexed id, string content, uint64 updatedAt);
event TaskToggled(address indexed owner, uint256 indexed id, bool completed, uint64 updatedAt);
event TaskDeleted(address indexed owner, uint256 indexed id);
event CompletedCleared(address indexed owner, uint256 removed);

error EmptyContent();
error ContentTooLong(uint256 length, uint256 maxLength);
error TaskNotFound(address owner, uint256 id);
error TaskLimitReached(uint256 limit);
error OffsetOutOfRange(uint256 offset, uint256 taskCount);

function taskCount(address owner) external view returns (uint256);
function completedCount(address owner) external view returns (uint256);
function nextTaskId(address owner) external view returns (uint256);
function hasTask(address owner, uint256 id) external view returns (bool);
function getTask(address owner, uint256 id) external view returns (Task memory);
function getTasks(address owner) external view returns (Task[] memory);
function getTasksPaged(address owner, uint256 offset, uint256 limit) external view returns (Task[] memory);

function createTask(string calldata content) external returns (uint256 id);
function updateTask(uint256 id, string calldata content) external;
function toggleTask(uint256 id) external returns (bool completed);
function deleteTask(uint256 id) external;
function clearCompleted() external returns (uint256 removed);
```

### Required constants

These go in your contract (not in the interface), public and constant, because the tests read them
as getters (`todo.MAX_CONTENT_LENGTH()`):

```solidity
uint256 public constant MAX_CONTENT_LENGTH = 160;
uint256 public constant MAX_TASKS_PER_OWNER = 50;
```

### Constructor

There is none. `TodoList` takes no constructor arguments and grants the deployer no privileges
whatsoever — that is what makes it decentralized. The deploy script just calls `new TodoList()`.

## Behavioural rules

Every rule has its own test in `test/02-todo-list/TodoList.t.sol`.

1. `createTask` reverts with `EmptyContent()` when `bytes(content).length == 0`.
2. `createTask` reverts with `ContentTooLong(length, MAX_CONTENT_LENGTH)` when the content exceeds
   160 bytes. Exactly 160 **is** valid.
3. `createTask` reverts with `TaskLimitReached(MAX_TASKS_PER_OWNER)` when the caller already holds
   50 **live** tasks. The cap counts live tasks, not ids ever issued, so deleting one frees a slot.
4. Ids start at **1** and increase by one per owner. They are **never reused**: after deleting task
   3, the next `createTask` still hands out 4. `nextTaskId(owner)` returns the id the next call will
   assign, so it is `1` for an address that has never created anything.
5. On the happy path, `createTask` appends a `Task` with `completed = false` and
   `createdAt == updatedAt == block.timestamp`, returns its id and emits
   `TaskCreated(msg.sender, id, content, uint64(block.timestamp))`.
6. Lists are namespaced by `msg.sender`. Alice's id 1 and Bob's id 1 are two unrelated tasks, and
   `taskCount`/`nextTaskId` are per address. A contract calling the list is just another owner.
7. `getTask(owner, id)` reverts with `TaskNotFound(owner, id)` when the task does not exist —
   unknown, already deleted, or belonging to somebody else. `hasTask(owner, id)` answers `false`
   instead of reverting. `getTasks` and `getTasksPaged` are readable by anyone, for any owner.
8. `updateTask` validates the content exactly like `createTask` (`EmptyContent`, `ContentTooLong`),
   reverts with `TaskNotFound(msg.sender, id)` for an id the caller does not own, keeps `id`,
   `completed` and `createdAt`, refreshes `updatedAt` and emits `TaskUpdated`. Editing a completed
   task does **not** uncheck it.
9. `toggleTask` flips `completed`, refreshes `updatedAt`, keeps `completedCount(msg.sender)` in
   sync, returns the state **after** the flip and emits
   `TaskToggled(msg.sender, id, completed, updatedAt)`. Toggling twice restores the original state.
   `TaskNotFound(msg.sender, id)` otherwise.
10. `deleteTask` removes the task, emits `TaskDeleted(msg.sender, id)` and reverts with
    `TaskNotFound` for an unknown id — including a second delete of the same id. Deleting a
    completed task decrements `completedCount`.
11. **Deletion must be O(1)**: move the **last** task of the list into the freed slot and pop the
    array. That changes the order of `getTasks` — after deleting the middle of `[1, 2, 3]` you get
    `[1, 3]`, and after deleting the head you get `[3, 2]` — but every surviving task must still be
    reachable by its id. Getting the index bookkeeping right for the task you moved is the whole
    exercise.
12. `clearCompleted` removes every completed task of the caller in one transaction, returns how many
    it removed, leaves `completedCount(msg.sender)` at 0 and every survivor reachable by id. It
    emits exactly one `CompletedCleared(msg.sender, removed)`, **always** — including the no-op case
    where it removes nothing. It never touches another owner's list and never rewinds `nextTaskId`.
13. `getTasksPaged(owner, offset, limit)` returns a window over `getTasks(owner)`, in the same order.
    It returns fewer than `limit` items when the window runs past the end, an empty array when
    `limit == 0` or `offset == taskCount(owner)` (so a paging loop terminates cleanly), and reverts
    with `OffsetOutOfRange(offset, taskCount(owner))` only when `offset` is **strictly greater**
    than the count.

## Concepts you will practise

- Namespacing state per caller: `mapping(address => T[])` and why it beats an access-control
  modifier here.
- Nested mappings (`mapping(address => mapping(uint256 => ...))`) and what they cost.
- The **swap-and-pop** idiom for O(1) removal from a dynamic array, and the index that has to be
  fixed up along with it.
- The `index + 1` sentinel trick: how to tell "stored at position 0" from "not stored at all" when
  every unset mapping slot reads as 0.
- Stable ids versus moving storage positions, and why a front end wants the former.
- Struct packing: `bool + uint64 + uint64` share a slot, `uint256 id` and `string content` do not.
- Allocating and filling a `memory` array (`new Task[](size)`) for pagination.
- `bytes(content).length` as the real byte length of a string.
- Custom errors with arguments, and choosing between reverting (`getTask`) and answering
  (`hasTask`).
- `calldata` versus `memory` parameters, and copying `calldata` straight into `storage`.
- Deleting from `storage`: what `delete` actually does to a mapping entry and what it costs (gas
  refunds).

## Hints

- The minimum state you need is three mappings: the tasks themselves, an id → position index, and a
  per-owner id counter. `completedCount` can be a fourth — a `mapping(address => uint256) public`
  already generates a getter that satisfies the interface.
- Store the index as **`position + 1`** so that `0` means "absent". Then `hasTask` is just
  `_slotOf[owner][id] != 0`, and you get the existence check and the lookup out of a single read.
- Write one private helper that resolves an id owned by `msg.sender` into a `Task storage` (or
  reverts with `TaskNotFound`), and reuse it from `updateTask`, `toggleTask` and `deleteTask`. Same
  for the content validation shared by `createTask` and `updateTask`.
- Swap-and-pop, in order: read the victim, clear **its** index entry, and only then, if it was not
  already the last element, copy the last task over it and point the index of the **moved** task at
  its new position. Forgetting that last line is the classic bug — and
  `testFuzz_DeleteTask_KeepsEveryRemainingTaskReadable` exists precisely to catch it.
- For `clearCompleted`, iterate **backwards** (`for (uint256 i = list.length; i > 0; )`, decrementing
  first). Going forwards while removing elements makes you skip the task that swap-and-pop just
  moved into the slot you are standing on.
- `block.timestamp` is a `uint256`; the struct wants a `uint64`. Cast once into a local and reuse it
  — it is cheaper and it guarantees `createdAt == updatedAt` on creation.
- `getTasks` can be a one-liner: returning a `storage` dynamic array from an `external view`
  function copies it to memory for you.
- For `getTasksPaged`, compute the size **before** allocating: `min(limit, taskCount - offset)`.
  Allocate exactly that, and never write past it.
- Do not use `delete list[index]` to remove a task from the array: that zeroes the slot but keeps
  the length, leaving a hole in `getTasks`.

## Commands

All from the repo root. Foundry is installed on the host (`forge --version` → 1.7.1); the details are
in `packages/contracts/README.md`.

```sh
bun run setup               # once: bun install + forge-std v1.16.2
bun run contracts:build     # compile
bun run contracts:test      # forge test -vvv
bun run contracts:fmt       # forge fmt (CI checks the formatting)
```

Iterating on a single test:

```sh
forge test --root packages/contracts --match-contract TodoListTest -vvv
forge test --root packages/contracts --match-test test_DeleteTask_SwapsTheLastTaskIntoTheHole -vvvv
forge test --root packages/contracts --match-test testFuzz_DeleteTask --fuzz-runs 1000
bun run contracts:test:watch   # re-runs the suite every time you save
```

Trying it out on the local chain and in the UI:

```sh
cp .env.example .env                  # once, read by Bun and forge
cp .env.example apps/web/.env.local   # once, for Next.js
nvm use                               # Node 22.16.0; the system one is v16 and won't do
bun run chain                         # anvil on 127.0.0.1:8545 (chain id 31337), another terminal
bun run contracts:deploy:02           # deploy + bun run sync (ABI and address)
bun run dev                           # http://localhost:3000/exercises/02-todo-list
```

`bun run contracts:deploy` deploys **every** exercise in one go and then syncs; use it when the
whole `src/` tree compiles. While any exercise is still a skeleton, `contracts:deploy:02` on its own
fails too — `forge script` compiles the entire project before it runs anything.

## When you are done

- [ ] `bun run contracts:build` compiles with no warnings.
- [ ] `bun run contracts:test` passes 100% (53 tests).
- [ ] `bun run contracts:fmt:check` has nothing to complain about.
- [ ] `FOUNDRY_PROFILE=ci forge test --root packages/contracts` passes too (the 1000 fuzz runs CI
      uses; equivalent to `forge test --root packages/contracts --fuzz-runs 1000`).
- [ ] `forge build --root packages/contracts --sizes` and `bun run contracts:snapshot`: compare the
      gas of `createTask` against `toggleTask`. Where does the difference come from?
- [ ] `bun run contracts:coverage` to see which branches you are leaving uncovered.
- [ ] You deploy to anvil, create tasks from two different anvil accounts and see each wallet get
      its own list in the UI.
- [ ] You can explain, in one sentence, why `deleteTask` needs the id → index mapping updated for a
      task the caller never mentioned.
- [ ] You can explain why the `index + 1` sentinel exists, and what breaks without it.

## Optional challenges

If you change the interface, remember to update `packages/abi/src/todo-list.ts` (or regenerate it
with `bun run sync`) and the UI.

- Add `createTasks(string[] calldata contents)` for batch creation, and measure the gas saved
  against N separate transactions.
- Add a `priority` or a `dueDate` to `Task` and sort on the client — then work out what it would
  cost to sort on-chain instead.
- Add `transferTask(address to, uint256 id)`, moving a task between two lists. Mind the receiver's
  cap and the id it gets on the other side.
- Add `getPendingTasks(address owner)`. Note you have to count first and then allocate: `memory`
  arrays cannot be resized.
- Replace the id → index mapping with a linked list (`mapping(uint256 => uint256) next`) so
  deletion preserves order. What do you gain, and what do you pay for it?
- Make the content `bytes32` instead of `string` and measure the gas difference. What does the UI
  lose in exchange?
- Add a per-task `archived` flag instead of deleting, and see how it changes `getTasks`.
