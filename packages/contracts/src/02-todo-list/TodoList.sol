// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ITodoList} from "./ITodoList.sol";

contract TodoList is ITodoList {
  uint256 public constant MAX_CONTENT_LENGTH = 160;
  uint256 public constant MAX_TASKS_PER_OWNER = 50;

  mapping(address => Task[]) _taskList;
  mapping(address => uint256) _taskIncId;

  /// @inheritdoc ITodoList
  function taskCount(address owner) external view returns (uint256) {
    return _taskList[owner].length;
  }

  /// @inheritdoc ITodoList
  function completedCount(address owner) external view returns (uint256) {
    uint256 count;
    Task[] storage _userTasks = _taskList[owner];

    for (uint256 i = 0; i < _userTasks.length; i++) {
      if (!_userTasks[i].completed) {
        continue;
      }
      count++;
    }

    return count;
  }

  /// @inheritdoc ITodoList
  function nextTaskId(address owner) external view returns (uint256) {
    return _getNextTaskId(owner);
  }

  /// @inheritdoc ITodoList
  function hasTask(address owner, uint256 id) external view returns (bool) {
    Task[] storage _userTasks = _taskList[owner];

    for (uint256 i = 0; i < _userTasks.length; i++) {
      Task storage task = _userTasks[i];

      if (task.id == id) {
        return true;
      }
    }

    return false;
  }

  /// @inheritdoc ITodoList
  function getTask(address owner, uint256 id) external view returns (Task memory task) {
    Task[] storage _userTasks = _taskList[owner];

    for (uint256 i = 0; i < _userTasks.length; i++) {
      if (_userTasks[i].id == id) {
        return _userTasks[i];
      }
    }

    revert TaskNotFound(owner, id);
  }

  /// @inheritdoc ITodoList
  function getTasks(address owner) external view returns (Task[] memory) {
    return _taskList[owner];
  }

  /// @inheritdoc ITodoList
  function getTasksPaged(address owner, uint256 offset, uint256 limit) external view returns (Task[] memory) {
    if (limit == 0) {
      return new Task[](0);
    }

    Task[] storage tasks = _taskList[owner];
    uint256 total = tasks.length;

    if (offset > total) {
      revert OffsetOutOfRange(offset, total);
    }

    uint256 count = total - offset;
    if (count > limit) {
      count = limit;
    }

    Task[] memory result = new Task[](count);

    for (uint256 i = 0; i < count; i++) {
      result[i] = tasks[offset + i];
    }

    return result;
  }

  /// @inheritdoc ITodoList
  function createTask(string calldata content) external validateContent(content) returns (uint256 id) {
    Task[] storage tasks = _taskList[msg.sender];

    if (tasks.length >= MAX_TASKS_PER_OWNER) {
      revert TaskLimitReached(MAX_TASKS_PER_OWNER);
    }

    Task memory task = Task({
      id: _getMyNextTaskId(), content: content, completed: false, createdAt: block.timestamp, updatedAt: block.timestamp
    });

    tasks.push(task);

    _taskIncId[msg.sender] = task.id;

    emit TaskCreated(msg.sender, task.id, content, task.createdAt);

    return task.id;
  }

  /// @inheritdoc ITodoList
  function updateTask(uint256 id, string calldata content) external validateContent(content) {
    Task storage task = _taskList[msg.sender][_getMyTaskIndex(id)];
    task.content = content;
    task.updatedAt = block.timestamp;

    emit TaskUpdated(msg.sender, id, content, task.updatedAt);
  }

  /// @inheritdoc ITodoList
  function deleteTask(uint256 id) external {
    Task[] storage tasks = _taskList[msg.sender];
    uint256 index = _getMyTaskIndex(id);
    uint256 lastIndex = tasks.length - 1;

    // Swap-and-pop: one copy instead of shifting every later task down a slot.
    if (index != lastIndex) {
      tasks[index] = tasks[lastIndex];
    }

    tasks.pop();

    emit TaskDeleted(msg.sender, id);
  }

  /// @inheritdoc ITodoList
  function clearCompleted() external returns (uint256) {
    Task[] storage tasks = _taskList[msg.sender];
    uint256 originalLength = tasks.length;
    uint256 writeIndex = 0;

    for (uint256 i = 0; i < originalLength; i++) {
      if (!tasks[i].completed) {
        if (writeIndex != i) {
          tasks[writeIndex] = tasks[i];
        }
        writeIndex++;
      }
    }

    uint256 completed = originalLength - writeIndex;
    for (uint256 i = 0; i < completed; i++) {
      tasks.pop();
    }

    emit CompletedCleared(msg.sender, completed);

    return completed;
  }

  /// @inheritdoc ITodoList
  function toggleTask(uint256 id) external returns (bool completed) {
    Task storage task = _taskList[msg.sender][_getMyTaskIndex(id)];
    completed = !task.completed;
    task.completed = completed;
    task.updatedAt = block.timestamp;

    emit TaskToggled(msg.sender, id, completed, task.updatedAt);

    return completed;
  }

  // internal
  function _getMyNextTaskId() private view returns (uint256 id) {
    return _getNextTaskId(msg.sender);
  }

  function _getNextTaskId(address owner) private view returns (uint256 id) {
    return _taskIncId[owner] + 1;
  }

  function _getMyTaskIndex(uint256 id) private view returns (uint256) {
    Task[] storage tasks = _taskList[msg.sender];
    uint256 count = tasks.length;

    for (uint256 i = 0; i < count; i++) {
      Task storage task = tasks[i];
      if (task.id != id) {
        continue;
      }

      return i;
    }

    revert TaskNotFound(msg.sender, id);
  }

  modifier validateContent(string calldata content) {
    uint256 contentLength = bytes(content).length;

    if (contentLength == 0) {
      revert EmptyContent();
    }

    if (contentLength > MAX_CONTENT_LENGTH) {
      revert ContentTooLong(contentLength, MAX_CONTENT_LENGTH);
    }

    _;
  }
}
