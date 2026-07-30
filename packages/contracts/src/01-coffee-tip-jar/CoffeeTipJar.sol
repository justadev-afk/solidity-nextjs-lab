// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICoffeeTipJar} from "./ICoffeeTipJar.sol";

contract CoffeeTipJar is ICoffeeTipJar {
  uint256 public constant MAX_NAME_LENGTH = 32;
  uint256 public constant MAX_MESSAGE_LENGTH = 280;

  address private immutable _owner;
  uint256 private _minimumTip;
  uint256 private _totalTipped;
  mapping(address => uint256) private _tipsOf;
  Tip[] private _tipHistory;

  constructor(uint256 _initialMinimumTip) {
    _owner = msg.sender;
    _minimumTip = _initialMinimumTip;
  }

  /// @inheritdoc ICoffeeTipJar
  function owner() external view returns (address) {
    return _owner;
  }

  /// @inheritdoc ICoffeeTipJar
  function minimumTip() external view returns (uint256) {
    return _minimumTip;
  }

  /// @inheritdoc ICoffeeTipJar
  function totalTipped() external view returns (uint256) {
    return _totalTipped;
  }

  /// @inheritdoc ICoffeeTipJar
  function tipCount() external view returns (uint256) {
    return _tipHistory.length;
  }

  /// @inheritdoc ICoffeeTipJar
  function tipsOf(address supporter) external view returns (uint256) {
    return _tipsOf[supporter];
  }

  /// @inheritdoc ICoffeeTipJar
  function getTips() external view returns (Tip[] memory) {
    return _tipHistory;
  }

  /// @inheritdoc ICoffeeTipJar
  function getTip(uint256 index) external view returns (Tip memory) {
    return _tipHistory[index];
  }

  /// @inheritdoc ICoffeeTipJar
  function tip(string calldata name, string calldata message) external payable {
    uint256 nameLength = bytes(name).length;
    uint256 messageLength = bytes(message).length;

    if (nameLength > MAX_NAME_LENGTH) {
      revert NameTooLong(nameLength, MAX_NAME_LENGTH);
    }

    if (messageLength > MAX_MESSAGE_LENGTH) {
      revert MessageTooLong(messageLength, MAX_MESSAGE_LENGTH);
    }

    if (msg.value < _minimumTip) {
      revert TipTooSmall(msg.value, _minimumTip);
    }

    Tip storage t = _tipHistory.push();
    t.from = msg.sender;
    t.amount = msg.value;
    t.name = name;
    t.message = message;
    t.timestamp = block.timestamp;

    _totalTipped += t.amount;
    _tipsOf[t.from] += t.amount;

    emit TipReceived(msg.sender, msg.value, name, message, block.timestamp);
  }

  /// @inheritdoc ICoffeeTipJar
  function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;

    if (balance == 0) {
      revert NothingToWithdraw();
    }

    (bool success,) = _owner.call{value: balance}("");

    if (!success) {
      revert WithdrawFailed();
    }

    emit Withdrawn(_owner, balance);
  }

  /// @inheritdoc ICoffeeTipJar
  function setMinimumTip(uint256 newMinimum) external onlyOwner {
    uint256 oldMinimumTip = _minimumTip;
    _minimumTip = newMinimum;
    emit MinimumTipUpdated(oldMinimumTip, newMinimum);
  }

  // Modifiers
  modifier onlyOwner() {
    if (msg.sender != _owner) {
      revert NotOwner(msg.sender);
    }
    _;
  }
}
