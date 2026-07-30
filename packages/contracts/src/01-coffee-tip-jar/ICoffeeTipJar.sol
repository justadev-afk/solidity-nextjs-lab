// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ICoffeeTipJar
/// @notice Public surface of exercise 01 — a tip jar where anyone can buy the owner a coffee,
///         leaving a name and a message on-chain.
/// @dev This interface is the contract between three places and must not drift:
///      1. `CoffeeTipJar.sol` (written by you) implements it,
///      2. `test/01-coffee-tip-jar/CoffeeTipJar.t.sol` asserts it,
///      3. `packages/abi/src/coffee-tip-jar.ts` mirrors it for the Next.js app.
///      The `MAX_NAME_LENGTH` / `MAX_MESSAGE_LENGTH` constants are intentionally NOT declared
///      here: an interface cannot hold state variables, and these two are part of the
///      implementation's tuning, not of its call surface. Declaring them WOULD work — solc marks
///      the auto-generated getter of a `public constant` as `view` in the ABI (not `pure`), so
///      `function MAX_NAME_LENGTH() external view returns (uint256);` here is satisfied by
///      `uint256 public constant MAX_NAME_LENGTH = 32;` in the implementation. The tests read them
///      as getters off the concrete `CoffeeTipJar` type instead, so the interface stays minimal.
interface ICoffeeTipJar {
    /// @notice A single tip, stored forever in the jar.
    /// @dev Stored in a dynamic array; `getTips()` returns the whole history in arrival order.
    struct Tip {
        address from; // supporter who sent the tip
        uint256 amount; // amount in wei attached to the call
        string name; // display name, may be empty (anonymous)
        string message; // message left by the supporter
        uint256 timestamp; // `block.timestamp` of the tip
    }

    /// @notice Emitted on every accepted tip.
    /// @param from Supporter who sent the tip.
    /// @param amount Amount in wei received.
    /// @param name Display name provided by the supporter (may be empty).
    /// @param message Message provided by the supporter.
    /// @param timestamp Block timestamp at which the tip was stored.
    event TipReceived(address indexed from, uint256 amount, string name, string message, uint256 timestamp);

    /// @notice Emitted when the owner sweeps the jar.
    /// @param to Address that received the funds (always the owner).
    /// @param amount Amount in wei transferred out.
    event Withdrawn(address indexed to, uint256 amount);

    /// @notice Emitted when the owner changes the minimum accepted tip.
    /// @param previousMinimum Minimum before the change, in wei.
    /// @param newMinimum Minimum after the change, in wei.
    event MinimumTipUpdated(uint256 previousMinimum, uint256 newMinimum);

    /// @notice Thrown when a restricted function is called by anyone other than the owner.
    /// @param caller Address that attempted the call.
    error NotOwner(address caller);

    /// @notice Thrown when the value attached to `tip` is below `minimumTip()`.
    /// @param sent Amount in wei that was sent.
    /// @param minimum Minimum amount in wei currently required.
    error TipTooSmall(uint256 sent, uint256 minimum);

    /// @notice Thrown when `withdraw` is called while the jar holds no ether.
    error NothingToWithdraw();

    /// @notice Thrown when the ether transfer to the owner fails.
    error WithdrawFailed();

    /// @notice Thrown when the supporter name exceeds the on-chain limit.
    /// @param length Length in bytes of the name that was sent.
    /// @param maxLength Maximum length in bytes allowed.
    error NameTooLong(uint256 length, uint256 maxLength);

    /// @notice Thrown when the supporter message exceeds the on-chain limit.
    /// @param length Length in bytes of the message that was sent.
    /// @param maxLength Maximum length in bytes allowed.
    error MessageTooLong(uint256 length, uint256 maxLength);

    /// @notice Address allowed to withdraw funds and change the minimum tip.
    /// @return The owner address, fixed at construction time.
    function owner() external view returns (address);

    /// @notice Smallest tip the jar currently accepts.
    /// @return The minimum amount in wei.
    function minimumTip() external view returns (uint256);

    /// @notice Cumulative amount ever tipped. Withdrawals do NOT reset it.
    /// @return The lifetime total in wei.
    function totalTipped() external view returns (uint256);

    /// @notice Number of tips stored in the jar.
    /// @return The length of the tip history.
    function tipCount() external view returns (uint256);

    /// @notice Lifetime amount tipped by a single supporter.
    /// @param supporter Address to look up.
    /// @return The total amount in wei tipped by `supporter`.
    function tipsOf(address supporter) external view returns (uint256);

    /// @notice Full tip history, oldest first.
    /// @dev Convenience view for the front end; unbounded, so it is view-only by design.
    /// @return The complete array of stored tips.
    function getTips() external view returns (Tip[] memory);

    /// @notice Reads a single tip by position.
    /// @param index Zero-based position in the tip history.
    /// @return The tip stored at `index`.
    function getTip(uint256 index) external view returns (Tip memory);

    /// @notice Sends a tip to the jar together with a name and a message.
    /// @dev Reverts with `TipTooSmall`, `NameTooLong` or `MessageTooLong`. An empty `name` is
    ///      valid and is rendered as "Anonymous" by the front end.
    /// @param name Display name, up to `MAX_NAME_LENGTH` bytes. May be empty.
    /// @param message Message, up to `MAX_MESSAGE_LENGTH` bytes.
    function tip(string calldata name, string calldata message) external payable;

    /// @notice Transfers the whole balance of the jar to the owner.
    /// @dev Owner-only. Reverts with `NothingToWithdraw` when the balance is zero and with
    ///      `WithdrawFailed` when the transfer is rejected by the recipient.
    function withdraw() external;

    /// @notice Updates the minimum accepted tip.
    /// @dev Owner-only. Zero is a valid minimum.
    /// @param newMinimum New minimum amount in wei.
    function setMinimumTip(uint256 newMinimum) external;
}
