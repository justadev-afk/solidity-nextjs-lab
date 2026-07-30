// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICoffeeTipJar} from "./ICoffeeTipJar.sol";

contract CoffeeTipJar is ICoffeeTipJar {
    uint256 public constant MAX_NAME_LENGTH = 32;
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    address private immutable _owner;
    uint256 private _minimumTip;
    uint256 private _totalTipped;
    uint256 private _tipCount;
    mapping(address => uint256) private _tipsOf;
    Tip[] private _tipHistory;

    constructor(uint256 _initialMinimumTip) {
        _owner = msg.sender;
        _minimumTip = _initialMinimumTip;
    }

    /// @notice Address allowed to withdraw funds and change the minimum tip.
    /// @return The owner address, fixed at construction time.
    function owner() external view returns (address) {
        return _owner;
    }

    /// @notice Smallest tip the jar currently accepts.
    /// @return The minimum amount in wei.
    function minimumTip() external view returns (uint256) {
        return _minimumTip;
    }

    /// @notice Cumulative amount ever tipped. Withdrawals do NOT reset it.
    /// @return The lifetime total in wei.
    function totalTipped() external view returns (uint256) {
        return _totalTipped;
    }

    /// @notice Number of tips stored in the jar.
    /// @return The length of the tip history.
    function tipCount() external view returns (uint256) {
        return _tipCount;
    }

    /// @notice Lifetime amount tipped by a single supporter.
    /// @param supporter Address to look up.
    /// @return The total amount in wei tipped by `supporter`.
    function tipsOf(address supporter) external view returns (uint256) {
        return _tipsOf[supporter];
    }

    /// @notice Full tip history, oldest first.
    /// @dev Convenience view for the front end; unbounded, so it is view-only by design.
    /// @return The complete array of stored tips.
    function getTips() external view returns (Tip[] memory) {
        return _tipHistory;
    }

    /// @notice Reads a single tip by position.
    /// @param index Zero-based position in the tip history.
    /// @return The tip stored at `index`.
    function getTip(uint256 index) external view returns (Tip memory) {
        return _tipHistory[index];
    }

    /// @notice Sends a tip to the jar together with a name and a message.
    /// @dev Reverts with `TipTooSmall`, `NameTooLong` or `MessageTooLong`. An empty `name` is
    ///      valid and is rendered as "Anonymous" by the front end.
    /// @param name Display name, up to `MAX_NAME_LENGTH` bytes. May be empty.
    /// @param message Message, up to `MAX_MESSAGE_LENGTH` bytes.
    function tip(string calldata name, string calldata message) external payable {
        _processTip(name, message);
    }

    /// @notice Transfers the whole balance of the jar to the owner.
    /// @dev Owner-only. Reverts with `NothingToWithdraw` when the balance is zero and with
    ///      `WithdrawFailed` when the transfer is rejected by the recipient.
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;

        if (balance == 0) {
            revert NothingToWithdraw();
        }

        (bool success,) = payable(_owner).call{value: balance}("");

        if (!success) {
            revert WithdrawFailed();
        }

        emit Withdrawn(_owner, balance);
    }

    /// @notice Updates the minimum accepted tip.
    /// @dev Owner-only. Zero is a valid minimum.
    /// @param newMinimum New minimum amount in wei.
    function setMinimumTip(uint256 newMinimum) external onlyOwner {
        uint256 oldMinimumTip = _minimumTip;
        _minimumTip = newMinimum;
        emit MinimumTipUpdated(oldMinimumTip, newMinimum);
    }

    // Private functions

    function _processTip(string calldata name, string calldata message) private {
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

        Tip memory _tip =
            Tip({from: msg.sender, amount: msg.value, name: name, message: message, timestamp: block.timestamp});
        _tipHistory.push(_tip);
        _tipCount++;
        _totalTipped += msg.value;
        _tipsOf[msg.sender] += msg.value;

        emit TipReceived(msg.sender, msg.value, name, message, block.timestamp);
    }

    // Modifiers

    modifier onlyOwner() {
        if (msg.sender != _owner) {
            revert NotOwner(msg.sender);
        }
        _;
    }
}
