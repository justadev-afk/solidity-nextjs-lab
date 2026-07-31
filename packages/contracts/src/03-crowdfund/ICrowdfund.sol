// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ICrowdfund
/// @notice Public surface of exercise 03 — a decentralized crowdfunding protocol. Anybody can open
///         as many campaigns as they want by naming an ETH goal and a duration; anybody else can
///         back them with ETH. When the deadline passes the campaign is judged once and for all: if
///         it raised at least its goal the creator claims the money minus a protocol fee, and if it
///         did not every backer pulls their own contribution back, in full.
/// @dev This interface is the contract between three places and must not drift:
///      1. `Crowdfund.sol` (written by you) implements it,
///      2. `test/03-crowdfund/Crowdfund.t.sol` asserts it,
///      3. `packages/abi/src/crowdfund.ts` mirrors it for the Next.js app.
///      The `FEE_BPS` / `BPS_DENOMINATOR` / `MIN_DURATION` / `MAX_DURATION` / `MAX_TITLE_LENGTH`
///      constants are intentionally NOT declared here — an interface cannot hold state variables,
///      and they belong to the implementation's tuning rather than to its call surface. The tests
///      read them as getters off the concrete `Crowdfund` type, exactly like exercises 01 and 02.
///
///      Two shapes are new compared to exercise 02. First, ids are **global**, not per address:
///      there is one shared campaign registry, so campaign 0 is campaign 0 for everybody, and the
///      per-caller namespacing lives one level deeper, in `contributionOf(id, contributor)`. An id
///      is simply the campaign's position in the registry, from `0`, so nothing ever needs a `+1`.
///      Second, this contract holds **other people's money**: every function that moves ETH out of
///      it has to zero its own bookkeeping before it calls anything, because the receiver can call
///      straight back in.
interface ICrowdfund {
  /// @notice Lifecycle of a campaign. It is **derived**, never stored: the same three numbers
  ///         (`block.timestamp`, `pledged`, `goal`) always produce the same answer, so there is no
  ///         `finalize()` to call and no state that can go stale.
  enum Status {
    /// @dev The deadline has not been reached yet. Contributions are open, nothing can be claimed
    ///      and nothing can be refunded — not even once the goal has already been met.
    Active,
    /// @dev The deadline has passed with `pledged >= goal`. The creator can claim once; nobody
    ///      gets a refund.
    Successful,
    /// @dev The deadline has passed with `pledged < goal`. Every backer can pull their own money
    ///      back; the creator gets nothing.
    Failed
  }

  /// @notice A single campaign in the shared registry.
  /// @dev `creator`, `deadline` and `claimed` are declared next to each other on purpose: 20 + 8 +
  ///      1 bytes fit in a single 32-byte storage slot.
  struct Campaign {
    uint256 id; // global id, starts at 0 and is never reused; also its position in the registry
    address creator; // whoever called `createCampaign` (the only account that can claim)
    uint64 deadline; // unix seconds; the campaign is over once `block.timestamp >= deadline`
    bool claimed; // set by `claimFunds`, so a successful campaign can only pay out once
    string title; // human-readable label, 1 to `MAX_TITLE_LENGTH` bytes
    uint256 goal; // wei that has to be raised for the campaign to succeed
    uint256 pledged; // wei raised so far; historical, refunds do NOT decrease it
  }

  /// @notice Emitted when a new campaign enters the registry.
  /// @param id Freshly assigned global id.
  /// @param creator Account that opened the campaign (always `msg.sender`).
  /// @param title Text stored on chain.
  /// @param goal Amount in wei that has to be raised.
  /// @param deadline Unix second at which contributions close.
  event CampaignCreated(uint256 indexed id, address indexed creator, string title, uint256 goal, uint64 deadline);

  /// @notice Emitted on every accepted contribution.
  /// @param id Campaign that was backed.
  /// @param contributor Account that sent the ETH.
  /// @param amount Wei attached to this particular call.
  /// @param pledged Campaign total *after* this contribution.
  event ContributionMade(uint256 indexed id, address indexed contributor, uint256 amount, uint256 pledged);

  /// @notice Emitted when the creator of a successful campaign takes the money.
  /// @param id Campaign that paid out.
  /// @param creator Account that received `payout`.
  /// @param payout Wei sent to the creator, already net of the fee.
  /// @param fee Wei kept by the protocol.
  event FundsClaimed(uint256 indexed id, address indexed creator, uint256 payout, uint256 fee);

  /// @notice Emitted when a backer of a failed campaign pulls their money back.
  /// @param id Campaign that refunded.
  /// @param contributor Account that received the refund.
  /// @param amount Wei returned — always the full contribution, never a part of it.
  event RefundIssued(uint256 indexed id, address indexed contributor, uint256 amount);

  /// @notice Emitted when the protocol owner sweeps the accrued fees.
  /// @param to Address that received the fees (always the owner).
  /// @param amount Wei transferred out.
  event ProtocolFeesWithdrawn(address indexed to, uint256 amount);

  /// @notice Thrown when a campaign would be created with a goal of zero.
  error InvalidGoal();

  /// @notice Thrown when a campaign would run for less than `MIN_DURATION` or more than
  ///         `MAX_DURATION` seconds.
  /// @param duration Duration that was requested, in seconds.
  /// @param minDuration Shortest campaign the contract accepts.
  /// @param maxDuration Longest campaign the contract accepts.
  error InvalidDuration(uint256 duration, uint256 minDuration, uint256 maxDuration);

  /// @notice Thrown when a campaign would be created with an empty title.
  error EmptyTitle();

  /// @notice Thrown when the title exceeds the on-chain limit.
  /// @param length Length in bytes of the title that was sent.
  /// @param maxLength Maximum length in bytes allowed.
  error TitleTooLong(uint256 length, uint256 maxLength);

  /// @notice Thrown when an id has never been handed out, i.e. anything at or above
  ///         `campaignCount()`.
  /// @dev Ids are 0-based, so there is no "too small" case and `0` is a real campaign as soon as
  ///      one exists — but it is still out of range on an empty registry, where the valid interval
  ///      `0 ..= campaignCount() - 1` is empty.
  /// @param id Id that was not found.
  error CampaignNotFound(uint256 id);

  /// @notice Thrown when an action is attempted in the wrong phase of a campaign's life.
  /// @dev The single gate behind `contribute` (wants `Active`), `claimFunds` (wants `Successful`)
  ///      and `claimRefund` (wants `Failed`).
  /// @param id Campaign that was addressed.
  /// @param expected Status the action requires.
  /// @param actual Status the campaign is actually in right now.
  error InvalidStatus(uint256 id, Status expected, Status actual);

  /// @notice Thrown when `contribute` is called without attaching any ETH.
  error ZeroContribution();

  /// @notice Thrown when somebody other than the creator tries to claim a campaign's funds.
  /// @param id Campaign that was addressed.
  /// @param caller Account that made the call.
  /// @param creator Account that is actually allowed to claim.
  error NotCampaignCreator(uint256 id, address caller, address creator);

  /// @notice Thrown when the creator tries to claim a campaign that already paid out.
  /// @param id Campaign that was addressed.
  error AlreadyClaimed(uint256 id);

  /// @notice Thrown when a refund is requested by an account with nothing to get back — it never
  ///         backed the campaign, or it has already been refunded.
  /// @param id Campaign that was addressed.
  /// @param contributor Account that asked for the refund.
  error NothingToRefund(uint256 id, address contributor);

  /// @notice Thrown when somebody other than the protocol owner tries to sweep the fees.
  /// @param caller Account that made the call.
  /// @param owner Account that is actually allowed to sweep them.
  error NotProtocolOwner(address caller, address owner);

  /// @notice Thrown when the owner sweeps fees while none have accrued.
  error NoFeesToWithdraw();

  /// @notice Thrown when a low-level ETH transfer out of the contract fails.
  /// @dev Reverting here is what keeps the bookkeeping and the balance in sync: the whole call
  ///      is rolled back, so the contribution or the fee is credited again.
  /// @param to Address the transfer was aimed at.
  /// @param amount Wei that could not be delivered.
  error TransferFailed(address to, uint256 amount);

  /// @notice Account that collects the protocol fee. Fixed at deployment, never transferable.
  /// @return The protocol owner.
  function owner() external view returns (address);

  /// @notice Fees taken from successful campaigns that the owner has not swept yet.
  /// @dev Part of the contract's balance, but never refundable and never claimable by a creator.
  /// @return Accrued fees in wei.
  function protocolFees() external view returns (uint256);

  /// @notice How many campaigns have ever been created.
  /// @dev Ids are global, 0-based and dense: the valid range is always `0 ..= campaignCount() - 1`,
  ///      empty while the count is 0. This is a total, not the last id. Nothing is ever removed
  ///      from the registry, so it never goes down.
  /// @return The number of campaigns in the registry.
  function campaignCount() external view returns (uint256);

  /// @notice Reads a single campaign by id.
  /// @dev Reverts with `CampaignNotFound(id)` when the id was never handed out.
  /// @param id Id of the campaign.
  /// @return The stored campaign.
  function getCampaign(uint256 id) external view returns (Campaign memory);

  /// @notice A window over the registry, in ascending id order.
  /// @dev Never reverts — unlike `ITodoList.getTasksPaged`, an out-of-range window simply comes
  ///      back empty. Returns fewer than `limit` items when the window runs past the end, and an
  ///      empty array when `limit` is 0 or `offset >= campaignCount()`.
  /// @param offset Position to start from. Since ids are 0-based this **is** an id: the window
  ///        starts at campaign `offset`, and position `n` of the result holds campaign `offset + n`.
  /// @param limit Maximum number of campaigns to return.
  /// @return The requested slice of the registry.
  function getCampaigns(uint256 offset, uint256 limit) external view returns (Campaign[] memory);

  /// @notice Every campaign id opened by `creator`, in creation order.
  /// @param creator Account to look up.
  /// @return The ids `creator` has created; empty for an address that never created one.
  function campaignsOf(address creator) external view returns (uint256[] memory);

  /// @notice Current phase of a campaign.
  /// @dev Derived from `block.timestamp`, `pledged` and `goal` — see `Status`. Reverts with
  ///      `CampaignNotFound(id)` for an unknown id.
  /// @param id Id of the campaign.
  /// @return The campaign's status right now.
  function statusOf(uint256 id) external view returns (Status);

  /// @notice How much `contributor` currently has staked in campaign `id`.
  /// @dev Accumulates across calls and drops back to 0 once refunded. Reverts with
  ///      `CampaignNotFound(id)` for an unknown id.
  /// @param id Id of the campaign.
  /// @param contributor Account to look up.
  /// @return The contributor's refundable balance in wei.
  function contributionOf(uint256 id, address contributor) external view returns (uint256);

  /// @notice How many distinct addresses have ever backed campaign `id`.
  /// @dev Historical: a refund does not bring it back down, and a second contribution from the
  ///      same address does not push it up. Reverts with `CampaignNotFound(id)`.
  /// @param id Id of the campaign.
  /// @return The number of distinct backers.
  function backerCount(uint256 id) external view returns (uint256);

  /// @notice Opens a new campaign owned by `msg.sender`.
  /// @dev Reverts with `EmptyTitle`, `TitleTooLong`, `InvalidGoal` or `InvalidDuration`. Emits
  ///      `CampaignCreated`. Any address may hold any number of campaigns at once.
  /// @param title Label of the campaign, 1 to `MAX_TITLE_LENGTH` bytes.
  /// @param goal Wei that has to be raised; must be greater than 0.
  /// @param duration Seconds the campaign stays open, between `MIN_DURATION` and `MAX_DURATION`.
  ///        The deadline is `block.timestamp + duration`.
  /// @return id The id assigned to the new campaign.
  function createCampaign(string calldata title, uint256 goal, uint64 duration) external returns (uint256 id);

  /// @notice Backs campaign `id` with the attached ETH.
  /// @dev Reverts with `CampaignNotFound`, `ZeroContribution` or
  ///      `InvalidStatus(id, Status.Active, actual)`. Emits `ContributionMade`. Contributions from
  ///      the same address add up; there is no cap and the goal may be overshot.
  /// @param id Id of the campaign to back.
  function contribute(uint256 id) external payable;

  /// @notice Pays a successful campaign out to its creator, minus the protocol fee.
  /// @dev Reverts with `CampaignNotFound`, `NotCampaignCreator`,
  ///      `InvalidStatus(id, Status.Successful, actual)`, `AlreadyClaimed` or `TransferFailed`.
  ///      The fee is `pledged * FEE_BPS / BPS_DENOMINATOR` and stays in the contract as
  ///      `protocolFees()`. Emits `FundsClaimed`.
  /// @param id Id of the campaign to cash in.
  /// @return payout Wei actually sent to the creator.
  function claimFunds(uint256 id) external returns (uint256 payout);

  /// @notice Returns `msg.sender`'s whole contribution to a failed campaign.
  /// @dev Reverts with `CampaignNotFound`, `InvalidStatus(id, Status.Failed, actual)`,
  ///      `NothingToRefund` or `TransferFailed`. Refunds are always complete and never charged a
  ///      fee — the protocol only earns on success. Emits `RefundIssued`.
  /// @param id Id of the failed campaign.
  /// @return amount Wei returned to the caller.
  function claimRefund(uint256 id) external returns (uint256 amount);

  /// @notice Sends every accrued protocol fee to the owner.
  /// @dev Reverts with `NotProtocolOwner`, `NoFeesToWithdraw` or `TransferFailed`. Emits
  ///      `ProtocolFeesWithdrawn`. It must never be able to touch money that still belongs to a
  ///      campaign.
  /// @return amount Wei transferred to the owner.
  function withdrawProtocolFees() external returns (uint256 amount);
}
