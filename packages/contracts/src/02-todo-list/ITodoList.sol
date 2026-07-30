// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ITodoList
/// @notice Public surface of exercise 02 — a decentralized todo list. There is no owner and no
///         admin: every address keeps its own list, and the only account that can mutate a task is
///         the account that created it. Reads are open to everyone, because the chain is public
///         anyway.
/// @dev This interface is the contract between three places and must not drift:
///      1. `TodoList.sol` (written by you) implements it,
///      2. `test/02-todo-list/TodoList.t.sol` asserts it,
///      3. `packages/abi/src/todo-list.ts` mirrors it for the Next.js app.
///      The `MAX_CONTENT_LENGTH` / `MAX_TASKS_PER_OWNER` constants are intentionally NOT declared
///      here — an interface cannot hold state variables, and they belong to the implementation's
///      tuning rather than to its call surface. The tests read them as getters off the concrete
///      `TodoList` type, exactly like exercise 01 does with `MAX_NAME_LENGTH`.
///
///      Note the asymmetry that makes this exercise "decentralized": every **read** takes an
///      explicit `owner` argument, while every **write** acts implicitly on `msg.sender`. There is
///      no `deleteTaskOf(address,uint256)`, so no caller can ever reach into somebody else's list.
interface ITodoList {
  /// @notice A single task belonging to one owner.
  /// @dev `id` is unique per owner and never reused, so it stays a stable key for the front end
  ///      even though the storage position of a task can move (see `deleteTask`).
  struct Task {
    uint256 id; // per-owner id, starts at 1 and never repeats
    string content; // what has to be done
    bool completed; // flipped by `toggleTask`
    uint64 createdAt; // `block.timestamp` when the task was created
    uint64 updatedAt; // `block.timestamp` of the last mutation (create, update or toggle)
  }

  /// @notice Emitted when a new task enters an owner's list.
  /// @param owner Account the task belongs to (always `msg.sender`).
  /// @param id Freshly assigned per-owner id.
  /// @param content Text stored on chain.
  /// @param createdAt Block timestamp at which the task was created.
  event TaskCreated(address indexed owner, uint256 indexed id, string content, uint64 createdAt);

  /// @notice Emitted when the text of an existing task changes.
  /// @param owner Account the task belongs to.
  /// @param id Id of the task that was rewritten.
  /// @param content New text.
  /// @param updatedAt Block timestamp of the edit.
  event TaskUpdated(address indexed owner, uint256 indexed id, string content, uint64 updatedAt);

  /// @notice Emitted when a task is checked or unchecked.
  /// @param owner Account the task belongs to.
  /// @param id Id of the task that was toggled.
  /// @param completed Completion state *after* the toggle.
  /// @param updatedAt Block timestamp of the toggle.
  event TaskToggled(address indexed owner, uint256 indexed id, bool completed, uint64 updatedAt);

  /// @notice Emitted when a task is removed from an owner's list.
  /// @param owner Account the task belonged to.
  /// @param id Id of the removed task. It is never handed out again.
  event TaskDeleted(address indexed owner, uint256 indexed id);

  /// @notice Emitted once per `clearCompleted` call, even when it removes nothing.
  /// @dev Deliberately a single summary event instead of one `TaskDeleted` per task: the front end
  ///      only needs a signal to refetch, and a loop of events would make the gas cost of a bulk
  ///      clear depend on how noisy the log is.
  /// @param owner Account whose completed tasks were dropped.
  /// @param removed How many tasks were removed.
  event CompletedCleared(address indexed owner, uint256 removed);

  /// @notice Thrown when a task would be stored with empty content.
  error EmptyContent();

  /// @notice Thrown when the content exceeds the on-chain limit.
  /// @param length Length in bytes of the content that was sent.
  /// @param maxLength Maximum length in bytes allowed.
  error ContentTooLong(uint256 length, uint256 maxLength);

  /// @notice Thrown when an id does not exist in `owner`'s list — unknown, already deleted, or
  ///         simply belonging to somebody else.
  /// @param owner List that was searched (for writes, always `msg.sender`).
  /// @param id Id that was not found.
  error TaskNotFound(address owner, uint256 id);

  /// @notice Thrown when the caller already holds the maximum number of live tasks.
  /// @dev Deleting a task frees a slot; the cap counts live tasks, not ids ever issued.
  /// @param limit Maximum number of live tasks per owner.
  error TaskLimitReached(uint256 limit);

  /// @notice Thrown when a pagination window starts past the end of the list.
  /// @param offset Offset that was requested.
  /// @param taskCount Number of live tasks the owner actually has.
  error OffsetOutOfRange(uint256 offset, uint256 taskCount);

  /// @notice Number of live tasks owned by `owner`.
  /// @param owner Account to look up.
  /// @return The length of `owner`'s list.
  function taskCount(address owner) external view returns (uint256);

  /// @notice Number of live tasks owned by `owner` that are marked as completed.
  /// @param owner Account to look up.
  /// @return How many of `owner`'s tasks are completed.
  function completedCount(address owner) external view returns (uint256);

  /// @notice Id that the next `createTask` from `owner` will assign.
  /// @dev `1` for an address that has never created a task. Ids are never reused, so this only
  ///      ever goes up — deleting a task does not give its id back.
  /// @param owner Account to look up.
  /// @return The next id for `owner`.
  function nextTaskId(address owner) external view returns (uint256);

  /// @notice Whether `owner` currently holds a live task with id `id`.
  /// @dev The non-reverting counterpart of `getTask`.
  /// @param owner Account to look up.
  /// @param id Id to check.
  /// @return `true` when the task exists and has not been deleted.
  function hasTask(address owner, uint256 id) external view returns (bool);

  /// @notice Reads a single task by owner and id.
  /// @dev Reverts with `TaskNotFound(owner, id)` when it does not exist.
  /// @param owner Account the task belongs to.
  /// @param id Id of the task.
  /// @return The stored task.
  function getTask(address owner, uint256 id) external view returns (Task memory);

  /// @notice Every live task of `owner`, in storage order.
  /// @dev Storage order is creation order until the first deletion; `deleteTask` swaps the last
  ///      task into the freed slot, so it is NOT sorted by id in general. Unbounded, view-only by
  ///      design — use `getTasksPaged` from anything that has to scale.
  /// @param owner Account to look up.
  /// @return The complete array of `owner`'s tasks.
  function getTasks(address owner) external view returns (Task[] memory);

  /// @notice A window over `getTasks(owner)`, in the same order.
  /// @dev Returns fewer than `limit` items when the window runs past the end, and an empty array
  ///      when `limit` is 0 or `offset` sits exactly at `taskCount(owner)`. Reverts with
  ///      `OffsetOutOfRange` only when `offset` is strictly greater than `taskCount(owner)`.
  /// @param owner Account to look up.
  /// @param offset Zero-based position to start from.
  /// @param limit Maximum number of tasks to return.
  /// @return The requested slice of `owner`'s tasks.
  function getTasksPaged(address owner, uint256 offset, uint256 limit) external view returns (Task[] memory);

  /// @notice Appends a task to `msg.sender`'s list.
  /// @dev Reverts with `EmptyContent`, `ContentTooLong` or `TaskLimitReached`. Emits `TaskCreated`.
  /// @param content Text of the task, 1 to `MAX_CONTENT_LENGTH` bytes.
  /// @return id The id assigned to the new task.
  function createTask(string calldata content) external returns (uint256 id);

  /// @notice Rewrites the content of one of `msg.sender`'s tasks.
  /// @dev Keeps `id`, `completed` and `createdAt`; refreshes `updatedAt`. Reverts with
  ///      `TaskNotFound`, `EmptyContent` or `ContentTooLong`. Emits `TaskUpdated`.
  /// @param id Id of the task to rewrite.
  /// @param content New text, 1 to `MAX_CONTENT_LENGTH` bytes.
  function updateTask(uint256 id, string calldata content) external;

  /// @notice Flips the completion flag of one of `msg.sender`'s tasks.
  /// @dev Refreshes `updatedAt`, keeps `completedCount` in sync and emits `TaskToggled`. Reverts
  ///      with `TaskNotFound`.
  /// @param id Id of the task to toggle.
  /// @return completed Completion state after the toggle.
  function toggleTask(uint256 id) external returns (bool completed);

  /// @notice Removes one of `msg.sender`'s tasks.
  /// @dev O(1): the last task of the list is moved into the freed slot and the array is popped, so
  ///      the order of the remaining tasks changes but every one of them stays reachable by id.
  ///      The id is burned, never reissued. Reverts with `TaskNotFound`. Emits `TaskDeleted`.
  /// @param id Id of the task to remove.
  function deleteTask(uint256 id) external;

  /// @notice Removes every completed task of `msg.sender` in a single transaction.
  /// @dev Always emits exactly one `CompletedCleared`, even when it removes nothing. Leaves
  ///      `completedCount(msg.sender)` at 0 and every surviving task reachable by id.
  /// @return removed How many tasks were removed.
  function clearCompleted() external returns (uint256 removed);
}
