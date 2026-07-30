// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// NOTE: this file does NOT compile until you implement `src/02-todo-list/TodoList.sol`.
// That file ships as an empty `contract TodoList is ITodoList {}`, so the first error you see is
// `Contract "TodoList" should be marked as abstract` — every interface function is still missing.
// A failing `forge build` / `forge test` is the intended starting point of the exercise:
// red -> green. Every test below maps to one of the behavioural rules in the exercise brief
// (`src/02-todo-list/README.md`).

import {ITodoList} from "../../src/02-todo-list/ITodoList.sol";
import {TodoList} from "../../src/02-todo-list/TodoList.sol";
import {Test, console2} from "forge-std/Test.sol";

contract TodoListTest is Test {
  uint64 internal constant START_TIMESTAMP = 1_700_000_000;

  TodoList internal todo;

  address internal alice;
  address internal bob;

  function setUp() public {
    vm.warp(START_TIMESTAMP);

    todo = new TodoList();

    alice = makeAddr("alice");
    bob = makeAddr("bob");
  }

  // ---------------------------------------------------------------------------------------
  // Constants and the empty state
  // ---------------------------------------------------------------------------------------

  function test_Constants_MatchTheBrief() public view {
    assertEq(todo.MAX_CONTENT_LENGTH(), 160, "MAX_CONTENT_LENGTH must be 160");
    assertEq(todo.MAX_TASKS_PER_OWNER(), 50, "MAX_TASKS_PER_OWNER must be 50");
  }

  function test_InitialState_IsEmptyForEveryone() public view {
    assertEq(todo.taskCount(alice), 0);
    assertEq(todo.completedCount(alice), 0);
    assertEq(todo.getTasks(alice).length, 0);
    assertEq(todo.taskCount(bob), 0);
    assertEq(todo.getTasks(bob).length, 0);
  }

  /// @dev Ids start at 1, so a brand-new address must already announce 1 — not 0.
  function test_InitialState_NextTaskIdStartsAtOne() public view {
    assertEq(todo.nextTaskId(alice), 1, "the first id handed out must be 1");
    assertEq(todo.nextTaskId(bob), 1);
    assertFalse(todo.hasTask(alice, 0));
    assertFalse(todo.hasTask(alice, 1));
  }

  // ---------------------------------------------------------------------------------------
  // Rules 1 to 3 — createTask validation
  // ---------------------------------------------------------------------------------------

  function test_CreateTask_RevertsOnEmptyContent() public {
    vm.expectRevert(abi.encodeWithSelector(ITodoList.EmptyContent.selector));
    vm.prank(alice);
    todo.createTask("");

    assertEq(todo.taskCount(alice), 0, "a rejected task must not be stored");
    assertEq(todo.nextTaskId(alice), 1, "a rejected task must not burn an id");
  }

  function test_CreateTask_RevertsWhenContentTooLong() public {
    uint256 maxLength = todo.MAX_CONTENT_LENGTH();
    string memory content = _stringOfLength(maxLength + 1);

    vm.expectRevert(abi.encodeWithSelector(ITodoList.ContentTooLong.selector, maxLength + 1, maxLength));
    vm.prank(alice);
    todo.createTask(content);

    assertEq(todo.taskCount(alice), 0);
  }

  function test_CreateTask_AcceptsContentOfMaxLength() public {
    string memory content = _stringOfLength(todo.MAX_CONTENT_LENGTH());

    vm.prank(alice);
    uint256 id = todo.createTask(content);

    assertEq(todo.getTask(alice, id).content, content, "exactly MAX_CONTENT_LENGTH bytes is valid");
  }

  // ---------------------------------------------------------------------------------------
  // Rules 4 to 6 — createTask happy path, ids and per-caller lists
  // ---------------------------------------------------------------------------------------

  function test_CreateTask_StoresTheWholeTaskAndReturnsItsId() public {
    vm.prank(alice);
    uint256 id = todo.createTask("write the contract");

    assertEq(id, 1, "the first task of an owner gets id 1");

    ITodoList.Task memory task = todo.getTask(alice, id);
    assertEq(task.id, 1);
    assertEq(task.content, "write the contract");
    assertFalse(task.completed, "a new task starts as pending");
    assertEq(task.createdAt, START_TIMESTAMP);
    assertEq(task.updatedAt, START_TIMESTAMP, "createdAt and updatedAt match on creation");

    assertEq(todo.taskCount(alice), 1);
    assertEq(todo.completedCount(alice), 0);
    assertTrue(todo.hasTask(alice, 1));
    assertEq(todo.nextTaskId(alice), 2);
  }

  function test_CreateTask_EmitsTaskCreated() public {
    vm.expectEmit(address(todo));
    emit ITodoList.TaskCreated(alice, 1, "buy milk", START_TIMESTAMP);

    vm.prank(alice);
    todo.createTask("buy milk");
  }

  function test_CreateTask_AssignsIncrementingIdsAndKeepsCreationOrder() public {
    assertEq(_create(alice, "one"), 1);
    vm.warp(START_TIMESTAMP + 60);
    assertEq(_create(alice, "two"), 2);
    assertEq(_create(alice, "three"), 3);

    ITodoList.Task[] memory tasks = todo.getTasks(alice);
    assertEq(tasks.length, 3);
    assertEq(tasks[0].content, "one");
    assertEq(tasks[1].content, "two");
    assertEq(tasks[2].content, "three");

    assertEq(tasks[0].createdAt, START_TIMESTAMP);
    assertEq(tasks[1].createdAt, START_TIMESTAMP + 60, "each task records its own block.timestamp");
    assertEq(todo.nextTaskId(alice), 4);
  }

  /// @dev The core of "decentralized": lists are namespaced by `msg.sender`, and ids restart at 1
  ///      for every address, so alice's #1 and bob's #1 are two unrelated tasks.
  function test_CreateTask_KeepsOneListPerCaller() public {
    _create(alice, "alice task");
    _create(bob, "bob task");
    _create(bob, "another bob task");

    assertEq(todo.taskCount(alice), 1);
    assertEq(todo.taskCount(bob), 2);
    assertEq(todo.getTask(alice, 1).content, "alice task");
    assertEq(todo.getTask(bob, 1).content, "bob task", "ids are per owner, not global");
    assertEq(todo.nextTaskId(alice), 2);
    assertEq(todo.nextTaskId(bob), 3);
  }

  /// @dev A contract is just another `msg.sender`; nothing about the design is EOA-specific.
  function test_CreateTask_WorksForContractCallers() public {
    ContractUser user = new ContractUser();
    uint256 id = user.createTask(todo, "called from a contract");

    assertEq(id, 1);
    assertEq(todo.taskCount(address(user)), 1);
    assertEq(todo.getTask(address(user), 1).content, "called from a contract");
    assertEq(todo.taskCount(alice), 0, "the test contract's own list stays untouched");
  }

  // ---------------------------------------------------------------------------------------
  // Rule 7 — the per-owner cap
  // ---------------------------------------------------------------------------------------

  function test_CreateTask_RevertsWhenLimitReached() public {
    uint256 limit = todo.MAX_TASKS_PER_OWNER();
    _fill(alice, limit);

    assertEq(todo.taskCount(alice), limit);

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskLimitReached.selector, limit));
    vm.prank(alice);
    todo.createTask("one too many");

    assertEq(todo.taskCount(alice), limit, "the list must stay at the cap");
  }

  function test_CreateTask_LimitIsPerOwner() public {
    uint256 limit = todo.MAX_TASKS_PER_OWNER();
    _fill(alice, limit);

    vm.prank(bob);
    uint256 id = todo.createTask("bob has room left");

    assertEq(id, 1, "bob's cap is his own");
    assertEq(todo.taskCount(bob), 1);
  }

  /// @dev The cap counts live tasks, not ids ever issued: deleting frees a slot but never
  ///      recycles the id.
  function test_CreateTask_DeletingFreesASlotWithoutReusingTheId() public {
    uint256 limit = todo.MAX_TASKS_PER_OWNER();
    _fill(alice, limit);

    vm.prank(alice);
    todo.deleteTask(1);

    vm.prank(alice);
    uint256 id = todo.createTask("back under the cap");

    assertEq(id, limit + 1, "ids keep going up, they are never reused");
    assertEq(todo.taskCount(alice), limit);
    assertFalse(todo.hasTask(alice, 1), "the deleted id stays gone");
  }

  // ---------------------------------------------------------------------------------------
  // Rule 8 — getTask / hasTask
  // ---------------------------------------------------------------------------------------

  function test_GetTask_RevertsForUnknownId() public {
    _create(alice, "only task");

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, alice, 2));
    todo.getTask(alice, 2);

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, alice, 0));
    todo.getTask(alice, 0);
  }

  /// @dev Ids are per owner, so alice's id 1 simply does not exist in bob's list.
  function test_GetTask_RevertsForAnotherOwnersId() public {
    _create(alice, "alice task");

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, bob, 1));
    todo.getTask(bob, 1);
  }

  function test_HasTask_AnswersInsteadOfReverting() public {
    _create(alice, "alice task");

    assertTrue(todo.hasTask(alice, 1));
    assertFalse(todo.hasTask(alice, 2));
    assertFalse(todo.hasTask(bob, 1));
    assertFalse(todo.hasTask(alice, 0));
  }

  /// @dev Reads are open: bob can inspect alice's list, he just cannot touch it.
  function test_Views_AreReadableByAnyone() public {
    _create(alice, "alice task");

    vm.prank(bob);
    ITodoList.Task[] memory tasks = todo.getTasks(alice);

    assertEq(tasks.length, 1);
    assertEq(tasks[0].content, "alice task");
  }

  // ---------------------------------------------------------------------------------------
  // Rule 9 — updateTask
  // ---------------------------------------------------------------------------------------

  function test_UpdateTask_RewritesContentAndRefreshesUpdatedAt() public {
    _create(alice, "old text");

    vm.warp(START_TIMESTAMP + 3_600);
    vm.prank(alice);
    todo.updateTask(1, "new text");

    ITodoList.Task memory task = todo.getTask(alice, 1);
    assertEq(task.content, "new text");
    assertEq(task.id, 1, "the id must not change");
    assertEq(task.createdAt, START_TIMESTAMP, "createdAt is immutable");
    assertEq(task.updatedAt, START_TIMESTAMP + 3_600, "updatedAt must move");
    assertEq(todo.taskCount(alice), 1, "an edit is not a new task");
  }

  function test_UpdateTask_EmitsTaskUpdated() public {
    _create(alice, "old text");
    vm.warp(START_TIMESTAMP + 10);

    vm.expectEmit(address(todo));
    emit ITodoList.TaskUpdated(alice, 1, "new text", START_TIMESTAMP + 10);

    vm.prank(alice);
    todo.updateTask(1, "new text");
  }

  function test_UpdateTask_KeepsTheCompletionFlag() public {
    _create(alice, "old text");

    vm.startPrank(alice);
    todo.toggleTask(1);
    todo.updateTask(1, "still done, just reworded");
    vm.stopPrank();

    assertTrue(todo.getTask(alice, 1).completed, "editing must not uncheck a task");
    assertEq(todo.completedCount(alice), 1);
  }

  function test_UpdateTask_RevertsForUnknownId() public {
    _create(alice, "only task");

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, alice, 99));
    vm.prank(alice);
    todo.updateTask(99, "ghost");
  }

  function test_UpdateTask_ValidatesContentLikeCreate() public {
    _create(alice, "only task");
    uint256 maxLength = todo.MAX_CONTENT_LENGTH();

    vm.expectRevert(abi.encodeWithSelector(ITodoList.EmptyContent.selector));
    vm.prank(alice);
    todo.updateTask(1, "");

    string memory tooLong = _stringOfLength(maxLength + 1);
    vm.expectRevert(abi.encodeWithSelector(ITodoList.ContentTooLong.selector, maxLength + 1, maxLength));
    vm.prank(alice);
    todo.updateTask(1, tooLong);

    assertEq(todo.getTask(alice, 1).content, "only task", "a rejected edit must change nothing");
  }

  function test_UpdateTask_CannotTouchAnotherOwnersTask() public {
    _create(alice, "alice task");

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, bob, 1));
    vm.prank(bob);
    todo.updateTask(1, "bob was here");

    assertEq(todo.getTask(alice, 1).content, "alice task");
  }

  // ---------------------------------------------------------------------------------------
  // Rule 10 — toggleTask
  // ---------------------------------------------------------------------------------------

  function test_ToggleTask_ChecksTheTaskAndEmits() public {
    _create(alice, "ship it");
    vm.warp(START_TIMESTAMP + 5);

    vm.expectEmit(address(todo));
    emit ITodoList.TaskToggled(alice, 1, true, START_TIMESTAMP + 5);

    vm.prank(alice);
    bool completed = todo.toggleTask(1);

    assertTrue(completed, "toggleTask returns the state AFTER the flip");
    assertTrue(todo.getTask(alice, 1).completed);
    assertEq(todo.getTask(alice, 1).updatedAt, START_TIMESTAMP + 5);
    assertEq(todo.completedCount(alice), 1);
  }

  function test_ToggleTask_TwiceRestoresTheOriginalState() public {
    _create(alice, "ship it");

    vm.startPrank(alice);
    todo.toggleTask(1);
    bool completed = todo.toggleTask(1);
    vm.stopPrank();

    assertFalse(completed);
    assertFalse(todo.getTask(alice, 1).completed);
    assertEq(todo.completedCount(alice), 0, "completedCount must come back down");
  }

  function test_ToggleTask_TracksCompletedCountAcrossTasks() public {
    _fill(alice, 3);

    vm.startPrank(alice);
    todo.toggleTask(1);
    todo.toggleTask(3);
    vm.stopPrank();

    assertEq(todo.completedCount(alice), 2);
    assertEq(todo.taskCount(alice), 3, "completing is not deleting");
    assertTrue(todo.getTask(alice, 1).completed);
    assertFalse(todo.getTask(alice, 2).completed);
    assertTrue(todo.getTask(alice, 3).completed);
  }

  function test_ToggleTask_RevertsForUnknownId() public {
    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, alice, 1));
    vm.prank(alice);
    todo.toggleTask(1);
  }

  function test_ToggleTask_CannotTouchAnotherOwnersTask() public {
    _create(alice, "alice task");

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, bob, 1));
    vm.prank(bob);
    todo.toggleTask(1);

    assertFalse(todo.getTask(alice, 1).completed);
    assertEq(todo.completedCount(alice), 0);
  }

  // ---------------------------------------------------------------------------------------
  // Rule 11 — deleteTask and the swap-and-pop consequence
  // ---------------------------------------------------------------------------------------

  function test_DeleteTask_RemovesTheTaskAndEmits() public {
    _create(alice, "throwaway");

    vm.expectEmit(address(todo));
    emit ITodoList.TaskDeleted(alice, 1);

    vm.prank(alice);
    todo.deleteTask(1);

    assertEq(todo.taskCount(alice), 0);
    assertEq(todo.getTasks(alice).length, 0);
    assertFalse(todo.hasTask(alice, 1));

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, alice, 1));
    todo.getTask(alice, 1);
  }

  function test_DeleteTask_RevertsForUnknownId() public {
    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, alice, 7));
    vm.prank(alice);
    todo.deleteTask(7);
  }

  function test_DeleteTask_RevertsOnSecondDelete() public {
    _create(alice, "throwaway");

    vm.prank(alice);
    todo.deleteTask(1);

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, alice, 1));
    vm.prank(alice);
    todo.deleteTask(1);
  }

  /// @dev O(1) removal moves the LAST task into the freed slot. The order of `getTasks` changes;
  ///      what must not change is that every surviving task is still reachable by its id.
  function test_DeleteTask_SwapsTheLastTaskIntoTheHole() public {
    _create(alice, "a"); // id 1
    _create(alice, "b"); // id 2
    _create(alice, "c"); // id 3

    vm.prank(alice);
    todo.deleteTask(2);

    ITodoList.Task[] memory tasks = todo.getTasks(alice);
    assertEq(tasks.length, 2);
    assertEq(tasks[0].id, 1);
    assertEq(tasks[0].content, "a");
    assertEq(tasks[1].id, 3, "the last task must take the freed slot, not shift everything left");
    assertEq(tasks[1].content, "c");

    assertEq(todo.getTask(alice, 3).content, "c", "the moved task must stay reachable by id");
    assertFalse(todo.hasTask(alice, 2));
  }

  function test_DeleteTask_FromTheFrontAlsoMovesTheLastTask() public {
    _create(alice, "a"); // id 1
    _create(alice, "b"); // id 2
    _create(alice, "c"); // id 3

    vm.prank(alice);
    todo.deleteTask(1);

    ITodoList.Task[] memory tasks = todo.getTasks(alice);
    assertEq(tasks.length, 2);
    assertEq(tasks[0].id, 3);
    assertEq(tasks[1].id, 2);
    assertEq(todo.getTask(alice, 2).content, "b");
    assertEq(todo.getTask(alice, 3).content, "c");
  }

  function test_DeleteTask_OfTheLastTaskKeepsTheRestInOrder() public {
    _create(alice, "a"); // id 1
    _create(alice, "b"); // id 2
    _create(alice, "c"); // id 3

    vm.prank(alice);
    todo.deleteTask(3);

    ITodoList.Task[] memory tasks = todo.getTasks(alice);
    assertEq(tasks.length, 2);
    assertEq(tasks[0].id, 1);
    assertEq(tasks[1].id, 2);
  }

  function test_DeleteTask_OfACompletedTaskDecrementsCompletedCount() public {
    _fill(alice, 2);

    vm.startPrank(alice);
    todo.toggleTask(1);
    todo.toggleTask(2);
    assertEq(todo.completedCount(alice), 2);
    todo.deleteTask(1);
    vm.stopPrank();

    assertEq(todo.completedCount(alice), 1, "deleting a completed task must decrement the counter");
    assertEq(todo.taskCount(alice), 1);
  }

  function test_DeleteTask_CannotTouchAnotherOwnersTask() public {
    _create(alice, "alice task");

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, bob, 1));
    vm.prank(bob);
    todo.deleteTask(1);

    assertEq(todo.taskCount(alice), 1);
  }

  // ---------------------------------------------------------------------------------------
  // Rule 12 — clearCompleted
  // ---------------------------------------------------------------------------------------

  function test_ClearCompleted_RemovesOnlyCompletedTasksAndEmits() public {
    _fill(alice, 4); // ids 1..4

    vm.startPrank(alice);
    todo.toggleTask(2);
    todo.toggleTask(4);
    vm.stopPrank();

    vm.expectEmit(address(todo));
    emit ITodoList.CompletedCleared(alice, 2);

    vm.prank(alice);
    uint256 removed = todo.clearCompleted();

    assertEq(removed, 2, "clearCompleted returns how many tasks it dropped");
    assertEq(todo.taskCount(alice), 2);
    assertEq(todo.completedCount(alice), 0);

    assertTrue(todo.hasTask(alice, 1));
    assertFalse(todo.hasTask(alice, 2));
    assertTrue(todo.hasTask(alice, 3));
    assertFalse(todo.hasTask(alice, 4));

    assertEq(todo.getTask(alice, 1).content, _label(1), "survivors must stay readable by id");
    assertEq(todo.getTask(alice, 3).content, _label(3));
  }

  function test_ClearCompleted_WithNothingCompletedIsANoOp() public {
    _fill(alice, 3);

    vm.expectEmit(address(todo));
    emit ITodoList.CompletedCleared(alice, 0);

    vm.prank(alice);
    uint256 removed = todo.clearCompleted();

    assertEq(removed, 0);
    assertEq(todo.taskCount(alice), 3, "nothing completed, nothing removed");
  }

  function test_ClearCompleted_CanEmptyTheWholeList() public {
    _fill(alice, 3);

    vm.startPrank(alice);
    todo.toggleTask(1);
    todo.toggleTask(2);
    todo.toggleTask(3);
    uint256 removed = todo.clearCompleted();
    vm.stopPrank();

    assertEq(removed, 3);
    assertEq(todo.taskCount(alice), 0);
    assertEq(todo.completedCount(alice), 0);
    assertEq(todo.getTasks(alice).length, 0);
    assertEq(todo.nextTaskId(alice), 4, "clearing does not rewind the id counter");
  }

  function test_ClearCompleted_OnlyTouchesTheCaller() public {
    _fill(alice, 2);
    _fill(bob, 2);

    vm.prank(alice);
    todo.toggleTask(1);
    vm.prank(bob);
    todo.toggleTask(1);

    vm.prank(alice);
    todo.clearCompleted();

    assertEq(todo.taskCount(alice), 1);
    assertEq(todo.taskCount(bob), 2, "bob's completed task must survive alice's cleanup");
    assertEq(todo.completedCount(bob), 1);
  }

  // ---------------------------------------------------------------------------------------
  // Rule 13 — pagination
  // ---------------------------------------------------------------------------------------

  function test_GetTasksPaged_ReturnsTheRequestedWindow() public {
    _fill(alice, 5); // ids 1..5

    ITodoList.Task[] memory page = todo.getTasksPaged(alice, 1, 2);

    assertEq(page.length, 2);
    assertEq(page[0].id, 2);
    assertEq(page[1].id, 3);
    assertEq(page[0].content, _label(2));
  }

  function test_GetTasksPaged_ClampsAtTheEnd() public {
    _fill(alice, 3);

    ITodoList.Task[] memory page = todo.getTasksPaged(alice, 2, 100);

    assertEq(page.length, 1, "the window must be clipped, not padded");
    assertEq(page[0].id, 3);
  }

  function test_GetTasksPaged_ZeroLimitReturnsEmpty() public {
    _fill(alice, 3);

    assertEq(todo.getTasksPaged(alice, 0, 0).length, 0);
  }

  /// @dev `offset == taskCount` is the natural stop condition of a paging loop, so it must be
  ///      valid and return an empty page rather than revert.
  function test_GetTasksPaged_OffsetAtTheEndReturnsEmpty() public {
    _fill(alice, 3);

    assertEq(todo.getTasksPaged(alice, 3, 10).length, 0);
    assertEq(todo.getTasksPaged(alice, 0, 10).length, 3);
  }

  function test_GetTasksPaged_RevertsWhenOffsetIsBeyondTheEnd() public {
    _fill(alice, 3);

    vm.expectRevert(abi.encodeWithSelector(ITodoList.OffsetOutOfRange.selector, 4, 3));
    todo.getTasksPaged(alice, 4, 1);
  }

  function test_GetTasksPaged_OnAnEmptyListOnlyAcceptsOffsetZero() public {
    assertEq(todo.getTasksPaged(alice, 0, 10).length, 0);

    vm.expectRevert(abi.encodeWithSelector(ITodoList.OffsetOutOfRange.selector, 1, 0));
    todo.getTasksPaged(alice, 1, 10);
  }

  // ---------------------------------------------------------------------------------------
  // Fuzz
  // ---------------------------------------------------------------------------------------

  function testFuzz_CreateTask_AcceptsAnyContentUpToMax(uint8 rawLength) public {
    uint256 length = bound(uint256(rawLength), 1, todo.MAX_CONTENT_LENGTH());
    string memory content = _stringOfLength(length);

    vm.prank(alice);
    uint256 id = todo.createTask(content);

    assertEq(todo.getTask(alice, id).content, content);
    assertEq(todo.taskCount(alice), 1);
  }

  function testFuzz_CreateTask_RejectsContentLongerThanMax(uint16 extra) public {
    uint256 maxLength = todo.MAX_CONTENT_LENGTH();
    uint256 length = maxLength + 1 + bound(uint256(extra), 0, 512);
    string memory content = _stringOfLength(length);

    vm.expectRevert(abi.encodeWithSelector(ITodoList.ContentTooLong.selector, length, maxLength));
    vm.prank(alice);
    todo.createTask(content);

    assertEq(todo.taskCount(alice), 0);
  }

  function testFuzz_ToggleTask_KeepsCompletedCountInSync(uint256 seed) public {
    uint256 total = 5;
    _fill(alice, total);

    bool[6] memory completed; // indexed by id, ids run 1..5
    uint256 expected;
    uint256 cursor = seed;

    for (uint256 round = 0; round < 12; round++) {
      uint256 id = (cursor % total) + 1;
      cursor = uint256(keccak256(abi.encode(cursor)));

      vm.prank(alice);
      bool nowCompleted = todo.toggleTask(id);

      completed[id] = !completed[id];
      expected = completed[id] ? expected + 1 : expected - 1;

      assertEq(nowCompleted, completed[id], "toggleTask must return the post-flip state");
      assertEq(todo.completedCount(alice), expected);
    }

    assertEq(todo.taskCount(alice), total, "toggling never adds or removes tasks");
  }

  function testFuzz_DeleteTask_KeepsEveryRemainingTaskReadable(uint256 seed) public {
    uint256 total = 8;
    _fill(alice, total);

    uint256 victim = (seed % total) + 1;

    vm.prank(alice);
    todo.deleteTask(victim);

    assertEq(todo.taskCount(alice), total - 1);
    assertFalse(todo.hasTask(alice, victim));

    for (uint256 id = 1; id <= total; id++) {
      if (id == victim) continue;
      assertTrue(todo.hasTask(alice, id), "a surviving task went missing from the index");
      ITodoList.Task memory task = todo.getTask(alice, id);
      assertEq(task.id, id);
      assertEq(task.content, _label(id), "swap-and-pop must not scramble id -> task");
    }
  }

  function testFuzz_GetTasksPaged_MatchesGetTasks(uint8 rawOffset, uint8 rawLimit) public {
    uint256 total = 7;
    _fill(alice, total);

    uint256 offset = bound(uint256(rawOffset), 0, total);
    uint256 limit = bound(uint256(rawLimit), 0, total + 3);

    ITodoList.Task[] memory all = todo.getTasks(alice);
    ITodoList.Task[] memory page = todo.getTasksPaged(alice, offset, limit);

    uint256 remaining = total - offset;
    uint256 expectedLength = limit < remaining ? limit : remaining;
    assertEq(page.length, expectedLength);

    for (uint256 i = 0; i < page.length; i++) {
      assertEq(page[i].id, all[offset + i].id);
      assertEq(page[i].content, all[offset + i].content);
    }
  }

  function testFuzz_Lists_StayIsolatedBetweenOwners(address other) public {
    vm.assume(other != alice && other != address(0));
    assumeNotForgeAddress(other);

    _create(alice, "alice task");

    assertEq(todo.taskCount(other), 0);
    assertFalse(todo.hasTask(other, 1));
    assertEq(todo.nextTaskId(other), 1);

    vm.expectRevert(abi.encodeWithSelector(ITodoList.TaskNotFound.selector, other, 1));
    vm.prank(other);
    todo.deleteTask(1);

    assertEq(todo.taskCount(alice), 1, "no address may reach into another list");
  }

  // ---------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------

  function _create(address owner, string memory content) internal returns (uint256 id) {
    vm.prank(owner);
    id = todo.createTask(content);
  }

  /// @dev Creates `count` tasks labelled `task 1`, `task 2`, ... so a task's content identifies
  ///      its id no matter where swap-and-pop moved it.
  function _fill(address owner, uint256 count) internal {
    vm.startPrank(owner);
    for (uint256 i = 1; i <= count; i++) {
      todo.createTask(_label(i));
    }
    vm.stopPrank();
  }

  function _label(uint256 index) internal pure returns (string memory) {
    return string.concat("task ", vm.toString(index));
  }

  function _stringOfLength(uint256 length) internal pure returns (string memory) {
    bytes memory buffer = new bytes(length);
    for (uint256 i = 0; i < length; i++) {
      buffer[i] = "a";
    }
    return string(buffer);
  }
}

/// @notice A contract that owns its own list, proving the design is not EOA-specific.
contract ContractUser {
  function createTask(TodoList todo, string calldata content) external returns (uint256) {
    return todo.createTask(content);
  }
}
