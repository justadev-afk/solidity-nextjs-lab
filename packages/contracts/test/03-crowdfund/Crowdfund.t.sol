// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// NOTE: this file does NOT compile until you implement `src/03-crowdfund/Crowdfund.sol`.
// That file ships as an empty `contract Crowdfund is ICrowdfund {}`, so the first error you see is
// `Contract "Crowdfund" should be marked as abstract` — every interface function is still missing.
// A failing `forge build` / `forge test` is the intended starting point of the exercise:
// red -> green. Every test below maps to one of the behavioural rules in the exercise brief
// (`src/03-crowdfund/README.md`).

import {Crowdfund} from "../../src/03-crowdfund/Crowdfund.sol";
import {ICrowdfund} from "../../src/03-crowdfund/ICrowdfund.sol";
import {Test, console2} from "forge-std/Test.sol";

contract CrowdfundTest is Test {
  uint64 internal constant START_TIMESTAMP = 1_700_000_000;
  uint64 internal constant DEFAULT_DURATION = 7 days;
  uint256 internal constant DEFAULT_GOAL = 10 ether;

  Crowdfund internal crowdfund;

  address internal protocolOwner;
  address internal alice; // creator
  address internal bob; // backer
  address internal carol; // backer

  function setUp() public {
    vm.warp(START_TIMESTAMP);

    protocolOwner = makeAddr("protocolOwner");
    alice = makeAddr("alice");
    bob = makeAddr("bob");
    carol = makeAddr("carol");

    // The deployer becomes the protocol owner, so it must be an account that can receive ETH —
    // the test contract itself has no `receive`, which is exactly the failure mode
    // `TransferFailed` exists for.
    vm.prank(protocolOwner);
    crowdfund = new Crowdfund();
  }

  // ---------------------------------------------------------------------------------------
  // Constants, deployment and the empty state
  // ---------------------------------------------------------------------------------------

  function test_Constants_MatchTheBrief() public view {
    assertEq(crowdfund.FEE_BPS(), 200, "FEE_BPS must be 200 (2%)");
    assertEq(crowdfund.BPS_DENOMINATOR(), 10_000, "BPS_DENOMINATOR must be 10_000");
    assertEq(crowdfund.MIN_DURATION(), 1 hours, "MIN_DURATION must be 1 hour");
    assertEq(crowdfund.MAX_DURATION(), 90 days, "MAX_DURATION must be 90 days");
    assertEq(crowdfund.MAX_TITLE_LENGTH(), 80, "MAX_TITLE_LENGTH must be 80");
  }

  function test_Deployment_MakesTheDeployerTheProtocolOwner() public view {
    assertEq(crowdfund.owner(), protocolOwner, "the deployer collects the protocol fee");
  }

  function test_InitialState_IsEmpty() public view {
    assertEq(crowdfund.campaignCount(), 0);
    assertEq(crowdfund.protocolFees(), 0);
    assertEq(address(crowdfund).balance, 0);
    assertEq(crowdfund.getCampaigns(0, 10).length, 0);
    assertEq(crowdfund.campaignsOf(alice).length, 0);
  }

  // ---------------------------------------------------------------------------------------
  // Rules 1 to 3 — createCampaign validation
  // ---------------------------------------------------------------------------------------

  function test_CreateCampaign_RevertsOnEmptyTitle() public {
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.EmptyTitle.selector));
    vm.prank(alice);
    crowdfund.createCampaign("", DEFAULT_GOAL, DEFAULT_DURATION);

    assertEq(crowdfund.campaignCount(), 0, "a rejected campaign must not burn an id");
  }

  function test_CreateCampaign_RevertsWhenTitleTooLong() public {
    uint256 maxLength = crowdfund.MAX_TITLE_LENGTH();
    string memory title = _stringOfLength(maxLength + 1);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.TitleTooLong.selector, maxLength + 1, maxLength));
    vm.prank(alice);
    crowdfund.createCampaign(title, DEFAULT_GOAL, DEFAULT_DURATION);

    assertEq(crowdfund.campaignCount(), 0);
  }

  function test_CreateCampaign_AcceptsTitleOfMaxLength() public {
    string memory title = _stringOfLength(crowdfund.MAX_TITLE_LENGTH());

    vm.prank(alice);
    uint256 id = crowdfund.createCampaign(title, DEFAULT_GOAL, DEFAULT_DURATION);

    assertEq(crowdfund.getCampaign(id).title, title, "exactly MAX_TITLE_LENGTH bytes is valid");
  }

  function test_CreateCampaign_RevertsOnZeroGoal() public {
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.InvalidGoal.selector));
    vm.prank(alice);
    crowdfund.createCampaign("free money", 0, DEFAULT_DURATION);

    assertEq(crowdfund.campaignCount(), 0);
  }

  function test_CreateCampaign_RevertsWhenDurationIsTooShort() public {
    uint64 minDuration = uint64(crowdfund.MIN_DURATION());
    uint64 maxDuration = uint64(crowdfund.MAX_DURATION());
    uint64 duration = minDuration - 1;

    vm.expectRevert(
      abi.encodeWithSelector(
        ICrowdfund.InvalidDuration.selector, uint256(duration), uint256(minDuration), uint256(maxDuration)
      )
    );
    vm.prank(alice);
    crowdfund.createCampaign("too fast", DEFAULT_GOAL, duration);
  }

  function test_CreateCampaign_RevertsWhenDurationIsTooLong() public {
    uint64 minDuration = uint64(crowdfund.MIN_DURATION());
    uint64 maxDuration = uint64(crowdfund.MAX_DURATION());
    uint64 duration = maxDuration + 1;

    vm.expectRevert(
      abi.encodeWithSelector(
        ICrowdfund.InvalidDuration.selector, uint256(duration), uint256(minDuration), uint256(maxDuration)
      )
    );
    vm.prank(alice);
    crowdfund.createCampaign("too slow", DEFAULT_GOAL, duration);
  }

  function test_CreateCampaign_AcceptsTheBoundaryDurations() public {
    uint64 minDuration = uint64(crowdfund.MIN_DURATION());
    uint64 maxDuration = uint64(crowdfund.MAX_DURATION());

    vm.startPrank(alice);
    uint256 shortest = crowdfund.createCampaign("shortest", DEFAULT_GOAL, minDuration);
    uint256 longest = crowdfund.createCampaign("longest", DEFAULT_GOAL, maxDuration);
    vm.stopPrank();

    assertEq(crowdfund.getCampaign(shortest).deadline, START_TIMESTAMP + minDuration, "MIN_DURATION is inclusive");
    assertEq(crowdfund.getCampaign(longest).deadline, START_TIMESTAMP + maxDuration, "MAX_DURATION is inclusive");
  }

  // ---------------------------------------------------------------------------------------
  // Rule 4 — createCampaign happy path and global ids
  // ---------------------------------------------------------------------------------------

  function test_CreateCampaign_StoresTheWholeCampaignAndReturnsItsId() public {
    vm.prank(alice);
    uint256 id = crowdfund.createCampaign("buy a espresso machine", DEFAULT_GOAL, DEFAULT_DURATION);

    assertEq(id, 1, "the first campaign ever gets id 1");

    ICrowdfund.Campaign memory campaign = crowdfund.getCampaign(id);
    assertEq(campaign.id, 1);
    assertEq(campaign.creator, alice);
    assertEq(campaign.title, "buy a espresso machine");
    assertEq(campaign.goal, DEFAULT_GOAL);
    assertEq(campaign.pledged, 0, "a fresh campaign has raised nothing");
    assertEq(campaign.deadline, START_TIMESTAMP + DEFAULT_DURATION, "deadline is now + duration");
    assertFalse(campaign.claimed);

    assertEq(crowdfund.campaignCount(), 1);
    assertEq(crowdfund.backerCount(id), 0);
    _assertStatus(id, ICrowdfund.Status.Active, "a fresh campaign is Active");
  }

  function test_CreateCampaign_EmitsCampaignCreated() public {
    vm.expectEmit(address(crowdfund));
    emit ICrowdfund.CampaignCreated(1, alice, "open source grant", DEFAULT_GOAL, START_TIMESTAMP + DEFAULT_DURATION);

    vm.prank(alice);
    crowdfund.createCampaign("open source grant", DEFAULT_GOAL, DEFAULT_DURATION);
  }

  /// @dev The big difference with exercise 02: ids are GLOBAL here, not per address. Campaign 1
  ///      is campaign 1 for everybody, so the registry is shared even though the money is not.
  function test_CreateCampaign_AssignsGlobalIncrementingIds() public {
    assertEq(_create(alice, "alice one"), 1);
    assertEq(_create(bob, "bob one"), 2, "bob does not restart at 1: the counter is shared");
    assertEq(_create(alice, "alice two"), 3);

    assertEq(crowdfund.campaignCount(), 3);
    assertEq(crowdfund.getCampaign(2).creator, bob);
  }

  function test_CreateCampaign_TracksCampaignsPerCreator() public {
    uint256 first = _create(alice, "alice one");
    _create(bob, "bob one");
    uint256 second = _create(alice, "alice two");

    uint256[] memory aliceIds = crowdfund.campaignsOf(alice);
    assertEq(aliceIds.length, 2);
    assertEq(aliceIds[0], first, "campaignsOf keeps creation order");
    assertEq(aliceIds[1], second);

    assertEq(crowdfund.campaignsOf(bob).length, 1);
    assertEq(crowdfund.campaignsOf(carol).length, 0);
  }

  function test_CreateCampaign_HasNoPerAddressCap() public {
    vm.startPrank(alice);
    for (uint256 i = 0; i < 12; i++) {
      crowdfund.createCampaign(_label(i), DEFAULT_GOAL, DEFAULT_DURATION);
    }
    vm.stopPrank();

    assertEq(crowdfund.campaignsOf(alice).length, 12, "an address may run any number of campaigns");
    assertEq(crowdfund.campaignCount(), 12);
  }

  // ---------------------------------------------------------------------------------------
  // Rule 5 — unknown ids
  // ---------------------------------------------------------------------------------------

  function test_Lookups_RevertForUnknownIds() public {
    _create(alice, "only campaign"); // id 1

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.CampaignNotFound.selector, 0));
    crowdfund.getCampaign(0);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.CampaignNotFound.selector, 2));
    crowdfund.getCampaign(2);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.CampaignNotFound.selector, 2));
    crowdfund.statusOf(2);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.CampaignNotFound.selector, 2));
    crowdfund.contributionOf(2, bob);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.CampaignNotFound.selector, 2));
    crowdfund.backerCount(2);
  }

  function test_Views_AreReadableByAnyone() public {
    uint256 id = _create(alice, "alice campaign");
    _back(bob, id, 1 ether);

    vm.prank(carol);
    ICrowdfund.Campaign memory campaign = crowdfund.getCampaign(id);

    assertEq(campaign.pledged, 1 ether, "reads are open to everybody");
    vm.prank(carol);
    assertEq(crowdfund.contributionOf(id, bob), 1 ether, "so is somebody else's contribution");
  }

  // ---------------------------------------------------------------------------------------
  // Rule 6 — statusOf is derived from time, never stored
  // ---------------------------------------------------------------------------------------

  function test_StatusOf_StaysActiveBeforeTheDeadlineEvenWhenTheGoalIsMet() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL);

    assertEq(crowdfund.getCampaign(id).pledged, DEFAULT_GOAL);
    _assertStatus(id, ICrowdfund.Status.Active, "reaching the goal early does NOT end the campaign");
  }

  function test_StatusOf_IsSuccessfulOnceTheDeadlinePassesWithTheGoalMet() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL);

    _end(id);

    _assertStatus(id, ICrowdfund.Status.Successful, "pledged == goal is enough");
  }

  function test_StatusOf_IsFailedOnceTheDeadlinePassesShortOfTheGoal() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL - 1 wei);

    _end(id);

    _assertStatus(id, ICrowdfund.Status.Failed, "one wei short is still a failure");
  }

  /// @dev The boundary is the whole point of `block.timestamp` here: the campaign is open while
  ///      `block.timestamp < deadline` and closed from the deadline second onwards.
  function test_StatusOf_FlipsExactlyAtTheDeadline() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL);

    uint64 deadline = crowdfund.getCampaign(id).deadline;

    vm.warp(deadline - 1);
    _assertStatus(id, ICrowdfund.Status.Active, "one second before the deadline it is still open");

    vm.warp(deadline);
    _assertStatus(id, ICrowdfund.Status.Successful, "at the deadline second it is already closed");
  }

  // ---------------------------------------------------------------------------------------
  // Rules 7 to 9 — contribute
  // ---------------------------------------------------------------------------------------

  function test_Contribute_RevertsForUnknownId() public {
    vm.deal(bob, 1 ether);
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.CampaignNotFound.selector, 1));
    vm.prank(bob);
    crowdfund.contribute{value: 1 ether}(1);
  }

  function test_Contribute_RevertsOnZeroValue() public {
    uint256 id = _create(alice, "campaign");

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.ZeroContribution.selector));
    vm.prank(bob);
    crowdfund.contribute{value: 0}(id);

    assertEq(crowdfund.backerCount(id), 0, "a rejected contribution must not count as a backer");
  }

  function test_Contribute_RevertsOnceTheCampaignSucceeded() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL);
    _end(id);

    vm.deal(carol, 1 ether);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICrowdfund.InvalidStatus.selector, id, ICrowdfund.Status.Active, ICrowdfund.Status.Successful
      )
    );
    vm.prank(carol);
    crowdfund.contribute{value: 1 ether}(id);
  }

  function test_Contribute_RevertsOnceTheCampaignFailed() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 1 ether);
    _end(id);

    vm.deal(carol, 1 ether);
    vm.expectRevert(
      abi.encodeWithSelector(ICrowdfund.InvalidStatus.selector, id, ICrowdfund.Status.Active, ICrowdfund.Status.Failed)
    );
    vm.prank(carol);
    crowdfund.contribute{value: 1 ether}(id);
  }

  function test_Contribute_StoresTheContributionAndEmits() public {
    uint256 id = _create(alice, "campaign");
    vm.deal(bob, 3 ether);

    vm.expectEmit(address(crowdfund));
    emit ICrowdfund.ContributionMade(id, bob, 3 ether, 3 ether);

    vm.prank(bob);
    crowdfund.contribute{value: 3 ether}(id);

    assertEq(crowdfund.contributionOf(id, bob), 3 ether);
    assertEq(crowdfund.getCampaign(id).pledged, 3 ether);
    assertEq(crowdfund.backerCount(id), 1);
    assertEq(address(crowdfund).balance, 3 ether, "the ETH stays in the contract until it is settled");
    assertEq(bob.balance, 0);
  }

  function test_Contribute_AccumulatesForTheSameBacker() public {
    uint256 id = _create(alice, "campaign");

    _back(bob, id, 1 ether);

    vm.deal(bob, 2 ether);
    vm.expectEmit(address(crowdfund));
    emit ICrowdfund.ContributionMade(id, bob, 2 ether, 3 ether);
    vm.prank(bob);
    crowdfund.contribute{value: 2 ether}(id);

    assertEq(crowdfund.contributionOf(id, bob), 3 ether, "contributions add up");
    assertEq(crowdfund.getCampaign(id).pledged, 3 ether);
    assertEq(crowdfund.backerCount(id), 1, "the same address is one backer, not two");
  }

  function test_Contribute_CountsDistinctBackers() public {
    uint256 id = _create(alice, "campaign");

    _back(bob, id, 1 ether);
    _back(carol, id, 2 ether);
    _back(bob, id, 1 ether);

    assertEq(crowdfund.backerCount(id), 2);
    assertEq(crowdfund.contributionOf(id, bob), 2 ether);
    assertEq(crowdfund.contributionOf(id, carol), 2 ether);
    assertEq(crowdfund.getCampaign(id).pledged, 4 ether);
  }

  /// @dev The nested mapping is what keeps two campaigns from ever sharing a cent, even when the
  ///      same address backs both of them.
  function test_Contribute_KeepsCampaignsIsolated() public {
    uint256 first = _create(alice, "first");
    uint256 second = _create(bob, "second");

    _back(carol, first, 1 ether);
    _back(carol, second, 4 ether);

    assertEq(crowdfund.contributionOf(first, carol), 1 ether);
    assertEq(crowdfund.contributionOf(second, carol), 4 ether);
    assertEq(crowdfund.getCampaign(first).pledged, 1 ether);
    assertEq(crowdfund.getCampaign(second).pledged, 4 ether);
    assertEq(address(crowdfund).balance, 5 ether, "one balance, two separate ledgers");
  }

  function test_Contribute_CanOvershootTheGoal() public {
    uint256 id = _create(alice, "campaign");

    _back(bob, id, DEFAULT_GOAL * 3);

    assertEq(crowdfund.getCampaign(id).pledged, DEFAULT_GOAL * 3, "there is no cap on a campaign");
    _end(id);
    _assertStatus(id, ICrowdfund.Status.Successful);
  }

  function test_ContributionOf_IsZeroForANonBacker() public {
    uint256 id = _create(alice, "campaign");
    assertEq(crowdfund.contributionOf(id, bob), 0, "an address that never backed answers 0");
  }

  // ---------------------------------------------------------------------------------------
  // Rules 10 and 11 — claimFunds
  // ---------------------------------------------------------------------------------------

  function test_ClaimFunds_RevertsForUnknownId() public {
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.CampaignNotFound.selector, 1));
    vm.prank(alice);
    crowdfund.claimFunds(1);
  }

  function test_ClaimFunds_RevertsForANonCreator() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL);
    _end(id);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.NotCampaignCreator.selector, id, bob, alice));
    vm.prank(bob);
    crowdfund.claimFunds(id);

    // Not even the protocol owner may take a creator's money.
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.NotCampaignCreator.selector, id, protocolOwner, alice));
    vm.prank(protocolOwner);
    crowdfund.claimFunds(id);
  }

  function test_ClaimFunds_RevertsWhileTheCampaignIsActive() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL);

    vm.expectRevert(
      abi.encodeWithSelector(
        ICrowdfund.InvalidStatus.selector, id, ICrowdfund.Status.Successful, ICrowdfund.Status.Active
      )
    );
    vm.prank(alice);
    crowdfund.claimFunds(id);
  }

  function test_ClaimFunds_RevertsWhenTheCampaignFailed() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 1 ether);
    _end(id);

    vm.expectRevert(
      abi.encodeWithSelector(
        ICrowdfund.InvalidStatus.selector, id, ICrowdfund.Status.Successful, ICrowdfund.Status.Failed
      )
    );
    vm.prank(alice);
    crowdfund.claimFunds(id);

    assertEq(address(crowdfund).balance, 1 ether, "a failed campaign keeps the money for the backers");
  }

  function test_ClaimFunds_PaysTheCreatorMinusTheFeeAndEmits() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 6 ether);
    _back(carol, id, 4 ether);
    _end(id);

    uint256 fee = _fee(10 ether);
    uint256 payout = 10 ether - fee;
    assertEq(fee, 0.2 ether, "2% of 10 ETH is 0.2 ETH");

    vm.expectEmit(address(crowdfund));
    emit ICrowdfund.FundsClaimed(id, alice, payout, fee);

    vm.prank(alice);
    uint256 returned = crowdfund.claimFunds(id);

    assertEq(returned, payout, "claimFunds returns what the creator actually received");
    assertEq(alice.balance, payout);
    assertEq(crowdfund.protocolFees(), fee, "the fee stays in the contract until the owner sweeps it");
    assertEq(address(crowdfund).balance, fee);
    assertTrue(crowdfund.getCampaign(id).claimed);
    assertEq(crowdfund.getCampaign(id).pledged, 10 ether, "pledged is historical, claiming does not zero it");
  }

  function test_ClaimFunds_RevertsOnASecondClaim() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL);
    _end(id);

    vm.prank(alice);
    crowdfund.claimFunds(id);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.AlreadyClaimed.selector, id));
    vm.prank(alice);
    crowdfund.claimFunds(id);

    assertEq(alice.balance, DEFAULT_GOAL - _fee(DEFAULT_GOAL), "the creator is paid exactly once");
  }

  function test_ClaimFunds_AccruesFeesAcrossCampaigns() public {
    uint256 first = _create(alice, "first");
    uint256 second = _create(bob, "second");

    _back(carol, first, 10 ether);
    _back(carol, second, 20 ether);
    _end(first);

    vm.prank(alice);
    crowdfund.claimFunds(first);
    vm.prank(bob);
    crowdfund.claimFunds(second);

    assertEq(crowdfund.protocolFees(), _fee(10 ether) + _fee(20 ether), "fees accumulate");
    assertEq(alice.balance, 10 ether - _fee(10 ether));
    assertEq(bob.balance, 20 ether - _fee(20 ether));
  }

  function test_ClaimFunds_RevertsWhenTheCreatorRejectsEth() public {
    RejectingAccount creator = new RejectingAccount(crowdfund);

    uint256 id = creator.createCampaign("contract campaign", DEFAULT_GOAL, DEFAULT_DURATION);
    _back(bob, id, DEFAULT_GOAL);
    _end(id);

    uint256 payout = DEFAULT_GOAL - _fee(DEFAULT_GOAL);
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.TransferFailed.selector, address(creator), payout));
    creator.claimFunds(id);

    assertFalse(crowdfund.getCampaign(id).claimed, "a failed transfer must roll the whole claim back");
    assertEq(crowdfund.protocolFees(), 0, "including the fee that was about to accrue");
    assertEq(address(crowdfund).balance, DEFAULT_GOAL);
  }

  /// @dev Checks-effects-interactions: `claimed` has to be set BEFORE the ETH leaves, otherwise a
  ///      creator contract can drain the campaign from its `receive`.
  function test_ClaimFunds_IsSafeAgainstReentrancy() public {
    ReentrantCreator creator = new ReentrantCreator(crowdfund);

    uint256 id = creator.createCampaign("reentrant campaign", DEFAULT_GOAL, DEFAULT_DURATION);
    _back(bob, id, 20 ether);
    _end(id);

    uint256 fee = _fee(20 ether);
    uint256 payout = 20 ether - fee;

    creator.claim();

    assertEq(creator.reentryAttempts(), 1, "the receive hook did run");
    assertFalse(creator.reentrySucceeded(), "the second claim must be rejected");
    assertEq(address(creator).balance, payout, "the creator is paid exactly once");
    assertEq(address(crowdfund).balance, fee, "only the protocol fee is left behind");
  }

  // ---------------------------------------------------------------------------------------
  // Rules 12 and 13 — claimRefund
  // ---------------------------------------------------------------------------------------

  function test_ClaimRefund_RevertsForUnknownId() public {
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.CampaignNotFound.selector, 1));
    vm.prank(bob);
    crowdfund.claimRefund(1);
  }

  function test_ClaimRefund_RevertsWhileTheCampaignIsActive() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 1 ether);

    vm.expectRevert(
      abi.encodeWithSelector(ICrowdfund.InvalidStatus.selector, id, ICrowdfund.Status.Failed, ICrowdfund.Status.Active)
    );
    vm.prank(bob);
    crowdfund.claimRefund(id);
  }

  function test_ClaimRefund_RevertsWhenTheCampaignSucceeded() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, DEFAULT_GOAL);
    _end(id);

    vm.expectRevert(
      abi.encodeWithSelector(
        ICrowdfund.InvalidStatus.selector, id, ICrowdfund.Status.Failed, ICrowdfund.Status.Successful
      )
    );
    vm.prank(bob);
    crowdfund.claimRefund(id);

    assertEq(bob.balance, 0, "backers of a successful campaign do not get their money back");
  }

  function test_ClaimRefund_RevertsForAnAddressThatNeverBacked() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 1 ether);
    _end(id);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.NothingToRefund.selector, id, carol));
    vm.prank(carol);
    crowdfund.claimRefund(id);
  }

  function test_ClaimRefund_ReturnsTheWholeContributionAndEmits() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 2 ether);
    _back(bob, id, 1 ether);
    _back(carol, id, 4 ether);
    _end(id);

    vm.expectEmit(address(crowdfund));
    emit ICrowdfund.RefundIssued(id, bob, 3 ether);

    vm.prank(bob);
    uint256 refunded = crowdfund.claimRefund(id);

    assertEq(refunded, 3 ether, "everything bob put in, in one go");
    assertEq(bob.balance, 3 ether);
    assertEq(crowdfund.contributionOf(id, bob), 0, "the ledger entry is cleared");
    assertEq(crowdfund.contributionOf(id, carol), 4 ether, "carol's money is untouched");
    assertEq(address(crowdfund).balance, 4 ether);
  }

  function test_ClaimRefund_ChargesNoFee() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 5 ether);
    _end(id);

    vm.prank(bob);
    crowdfund.claimRefund(id);

    assertEq(bob.balance, 5 ether, "a refund is never taxed: the protocol only earns on success");
    assertEq(crowdfund.protocolFees(), 0);
    assertEq(address(crowdfund).balance, 0);
  }

  function test_ClaimRefund_RevertsOnASecondRefund() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 1 ether);
    _end(id);

    vm.prank(bob);
    crowdfund.claimRefund(id);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.NothingToRefund.selector, id, bob));
    vm.prank(bob);
    crowdfund.claimRefund(id);

    assertEq(bob.balance, 1 ether, "one refund, not two");
  }

  function test_ClaimRefund_LeavesPledgedUntouched() public {
    uint256 id = _create(alice, "campaign");
    _back(bob, id, 1 ether);
    _back(carol, id, 2 ether);
    _end(id);

    vm.prank(bob);
    crowdfund.claimRefund(id);

    assertEq(crowdfund.getCampaign(id).pledged, 3 ether, "pledged records what was raised, not what is left");
    assertEq(crowdfund.backerCount(id), 2, "and the backer count is historical too");
    _assertStatus(id, ICrowdfund.Status.Failed, "refunding cannot flip a campaign back to Active");
  }

  function test_ClaimRefund_RevertsWhenTheBackerRejectsEth() public {
    RejectingAccount backer = new RejectingAccount(crowdfund);
    vm.deal(address(this), 1 ether);

    uint256 id = _create(alice, "campaign");
    backer.back{value: 1 ether}(id);
    _end(id);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.TransferFailed.selector, address(backer), 1 ether));
    backer.claimRefund(id);

    assertEq(crowdfund.contributionOf(id, address(backer)), 1 ether, "a failed transfer restores the ledger entry");
  }

  /// @dev The classic drain: a backer contract that calls `claimRefund` again from `receive`. It
  ///      only fails if the contribution is zeroed BEFORE the ETH goes out.
  function test_ClaimRefund_IsSafeAgainstReentrancy() public {
    ReentrantBacker attacker = new ReentrantBacker(crowdfund);
    vm.deal(address(this), 3 ether);

    uint256 id = _create(alice, "campaign");
    attacker.back{value: 3 ether}(id);
    _back(carol, id, 2 ether);
    _end(id);

    attacker.claim();

    assertEq(attacker.reentryAttempts(), 1, "the receive hook did run");
    assertFalse(attacker.reentrySucceeded(), "the second refund must be rejected");
    assertEq(address(attacker).balance, 3 ether, "the attacker gets back exactly what it put in");
    assertEq(address(crowdfund).balance, 2 ether, "carol's money is still there");
    assertEq(crowdfund.contributionOf(id, carol), 2 ether);
  }

  // ---------------------------------------------------------------------------------------
  // Rule 14 — withdrawProtocolFees
  // ---------------------------------------------------------------------------------------

  function test_WithdrawProtocolFees_RevertsForANonOwner() public {
    _successfulClaimedCampaign();

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.NotProtocolOwner.selector, bob, protocolOwner));
    vm.prank(bob);
    crowdfund.withdrawProtocolFees();
  }

  function test_WithdrawProtocolFees_RevertsWhenNothingHasAccrued() public {
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.NoFeesToWithdraw.selector));
    vm.prank(protocolOwner);
    crowdfund.withdrawProtocolFees();
  }

  function test_WithdrawProtocolFees_SendsEverythingToTheOwnerAndEmits() public {
    uint256 fee = _successfulClaimedCampaign();

    vm.expectEmit(address(crowdfund));
    emit ICrowdfund.ProtocolFeesWithdrawn(protocolOwner, fee);

    vm.prank(protocolOwner);
    uint256 amount = crowdfund.withdrawProtocolFees();

    assertEq(amount, fee);
    assertEq(protocolOwner.balance, fee);
    assertEq(crowdfund.protocolFees(), 0);
    assertEq(address(crowdfund).balance, 0);
  }

  function test_WithdrawProtocolFees_RevertsRightAfterASweep() public {
    _successfulClaimedCampaign();

    vm.startPrank(protocolOwner);
    crowdfund.withdrawProtocolFees();

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.NoFeesToWithdraw.selector));
    crowdfund.withdrawProtocolFees();
    vm.stopPrank();
  }

  /// @dev The owner's privilege is deliberately tiny: it may sweep fees and nothing else. Money
  ///      that still belongs to a live campaign has to be untouchable.
  function test_WithdrawProtocolFees_NeverTouchesCampaignMoney() public {
    uint256 fee = _successfulClaimedCampaign();

    uint256 live = _create(alice, "still running");
    _back(carol, live, 7 ether);

    vm.prank(protocolOwner);
    uint256 amount = crowdfund.withdrawProtocolFees();

    assertEq(amount, fee, "only the accrued fee leaves the contract");
    assertEq(address(crowdfund).balance, 7 ether, "the live campaign keeps every wei");
    assertEq(crowdfund.getCampaign(live).pledged, 7 ether);
  }

  function test_WithdrawProtocolFees_RevertsWhenTheOwnerRejectsEth() public {
    RejectingOwner rejectingOwner = new RejectingOwner();
    Crowdfund instance = rejectingOwner.crowdfund();

    vm.prank(alice);
    uint256 id = instance.createCampaign("campaign", DEFAULT_GOAL, DEFAULT_DURATION);

    vm.deal(bob, DEFAULT_GOAL);
    vm.prank(bob);
    instance.contribute{value: DEFAULT_GOAL}(id);

    vm.warp(uint256(instance.getCampaign(id).deadline));
    vm.prank(alice);
    instance.claimFunds(id);

    uint256 fee = _fee(DEFAULT_GOAL);
    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.TransferFailed.selector, address(rejectingOwner), fee));
    rejectingOwner.withdrawProtocolFees();

    assertEq(instance.protocolFees(), fee, "a failed sweep leaves the fees credited");
  }

  // ---------------------------------------------------------------------------------------
  // Rule 15 — pagination
  // ---------------------------------------------------------------------------------------

  function test_GetCampaigns_ReturnsTheRequestedWindowInIdOrder() public {
    _fill(5);

    ICrowdfund.Campaign[] memory page = crowdfund.getCampaigns(1, 2);

    assertEq(page.length, 2);
    assertEq(page[0].id, 2, "offset 0 is campaign id 1");
    assertEq(page[1].id, 3);
    assertEq(page[0].title, _label(2));
  }

  function test_GetCampaigns_ClampsAtTheEnd() public {
    _fill(3);

    ICrowdfund.Campaign[] memory page = crowdfund.getCampaigns(2, 100);

    assertEq(page.length, 1, "the window must be clipped, not padded");
    assertEq(page[0].id, 3);
  }

  function test_GetCampaigns_ZeroLimitReturnsEmpty() public {
    _fill(3);
    assertEq(crowdfund.getCampaigns(0, 0).length, 0);
  }

  /// @dev Unlike `ITodoList.getTasksPaged`, an out-of-range window here answers instead of
  ///      reverting: a registry everybody reads should never make a viewer handle an error.
  function test_GetCampaigns_OffsetPastTheEndReturnsEmptyInsteadOfReverting() public {
    _fill(3);

    assertEq(crowdfund.getCampaigns(3, 10).length, 0, "offset == count stops a paging loop cleanly");
    assertEq(crowdfund.getCampaigns(99, 10).length, 0, "and anything beyond that is empty too");
  }

  function test_GetCampaigns_OnAnEmptyRegistry() public view {
    assertEq(crowdfund.getCampaigns(0, 10).length, 0);
    assertEq(crowdfund.getCampaigns(5, 10).length, 0);
  }

  // ---------------------------------------------------------------------------------------
  // Fuzz
  // ---------------------------------------------------------------------------------------

  function testFuzz_CreateCampaign_AcceptsAnyDurationInRange(uint64 rawDuration) public {
    uint64 minDuration = uint64(crowdfund.MIN_DURATION());
    uint64 maxDuration = uint64(crowdfund.MAX_DURATION());
    uint64 duration = uint64(bound(uint256(rawDuration), minDuration, maxDuration));

    vm.prank(alice);
    uint256 id = crowdfund.createCampaign("fuzzed", DEFAULT_GOAL, duration);

    assertEq(crowdfund.getCampaign(id).deadline, START_TIMESTAMP + duration);
    _assertStatus(id, ICrowdfund.Status.Active);
  }

  function testFuzz_Contribute_AccumulatesExactly(uint96 rawFirst, uint96 rawSecond) public {
    uint256 first = bound(uint256(rawFirst), 1, 1_000 ether);
    uint256 second = bound(uint256(rawSecond), 1, 1_000 ether);

    uint256 id = _create(alice, "campaign");
    _back(bob, id, first);
    _back(bob, id, second);

    assertEq(crowdfund.contributionOf(id, bob), first + second);
    assertEq(crowdfund.getCampaign(id).pledged, first + second);
    assertEq(crowdfund.backerCount(id), 1);
    assertEq(address(crowdfund).balance, first + second);
  }

  /// @dev The accounting invariant the fee introduces: the protocol never keeps a wei more than
  ///      2%, and the creator never loses a wei to rounding that the protocol does not gain.
  function testFuzz_ClaimFunds_FeePlusPayoutAlwaysEqualsPledged(uint96 rawAmount) public {
    uint256 goal = 1 ether;
    uint256 amount = bound(uint256(rawAmount), goal, 100_000 ether);

    vm.prank(alice);
    uint256 id = crowdfund.createCampaign("fuzzed", goal, DEFAULT_DURATION);
    _back(bob, id, amount);
    _end(id);

    uint256 balanceBefore = address(crowdfund).balance;

    vm.prank(alice);
    uint256 payout = crowdfund.claimFunds(id);

    uint256 fee = crowdfund.protocolFees();
    assertEq(payout + fee, amount, "not a wei may be created or destroyed");
    assertEq(fee, amount * 200 / 10_000, "the fee is exactly 2%, floored");
    assertLe(fee * 50, amount, "the fee can never exceed 2% of what was raised");
    assertEq(address(crowdfund).balance, balanceBefore - payout);
  }

  function testFuzz_ClaimRefund_ReturnsExactlyWhatWasContributed(uint96 rawAmount) public {
    uint256 goal = 100_000 ether;
    uint256 amount = bound(uint256(rawAmount), 1, goal - 1);

    vm.prank(alice);
    uint256 id = crowdfund.createCampaign("fuzzed", goal, DEFAULT_DURATION);
    _back(bob, id, amount);
    _end(id);

    _assertStatus(id, ICrowdfund.Status.Failed);

    vm.prank(bob);
    uint256 refunded = crowdfund.claimRefund(id);

    assertEq(refunded, amount);
    assertEq(bob.balance, amount, "a refund is exact, to the wei");
    assertEq(address(crowdfund).balance, 0);
    assertEq(crowdfund.protocolFees(), 0);
  }

  function testFuzz_GetCampaigns_MatchesGetCampaign(uint8 rawOffset, uint8 rawLimit) public {
    uint256 total = 7;
    _fill(total);

    uint256 offset = bound(uint256(rawOffset), 0, total + 3);
    uint256 limit = bound(uint256(rawLimit), 0, total + 3);

    ICrowdfund.Campaign[] memory page = crowdfund.getCampaigns(offset, limit);

    uint256 remaining = offset >= total ? 0 : total - offset;
    uint256 expectedLength = limit < remaining ? limit : remaining;
    assertEq(page.length, expectedLength);

    for (uint256 i = 0; i < page.length; i++) {
      assertEq(page[i].id, offset + i + 1, "position n holds campaign id n + 1");
      assertEq(page[i].title, crowdfund.getCampaign(offset + i + 1).title);
    }
  }

  function testFuzz_Campaigns_StayIsolatedBetweenBackers(address other) public {
    vm.assume(other != bob && other != address(0) && other != address(crowdfund));
    assumeNotForgeAddress(other);

    uint256 id = _create(alice, "campaign");
    _back(bob, id, 1 ether);
    _end(id);

    assertEq(crowdfund.contributionOf(id, other), 0);

    vm.expectRevert(abi.encodeWithSelector(ICrowdfund.NothingToRefund.selector, id, other));
    vm.prank(other);
    crowdfund.claimRefund(id);

    assertEq(address(crowdfund).balance, 1 ether, "no address may pull out money it never put in");
  }

  // ---------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------

  function _create(address creator, string memory title) internal returns (uint256 id) {
    vm.prank(creator);
    id = crowdfund.createCampaign(title, DEFAULT_GOAL, DEFAULT_DURATION);
  }

  function _back(address backer, uint256 id, uint256 amount) internal {
    vm.deal(backer, backer.balance + amount);
    vm.prank(backer);
    crowdfund.contribute{value: amount}(id);
  }

  /// @dev Jumps to the deadline second, at which the campaign is already closed.
  function _end(uint256 id) internal {
    vm.warp(uint256(crowdfund.getCampaign(id).deadline));
  }

  /// @dev Creates `count` campaigns titled `campaign 1`, `campaign 2`, ... with ids 1..count.
  function _fill(uint256 count) internal {
    vm.startPrank(alice);
    for (uint256 i = 1; i <= count; i++) {
      crowdfund.createCampaign(_label(i), DEFAULT_GOAL, DEFAULT_DURATION);
    }
    vm.stopPrank();
  }

  /// @dev Runs one campaign all the way to a claimed success and returns the fee it accrued.
  function _successfulClaimedCampaign() internal returns (uint256 fee) {
    uint256 id = _create(alice, "successful campaign");
    _back(bob, id, DEFAULT_GOAL);
    _end(id);

    vm.prank(alice);
    crowdfund.claimFunds(id);

    fee = _fee(DEFAULT_GOAL);
  }

  function _fee(uint256 amount) internal view returns (uint256) {
    return amount * crowdfund.FEE_BPS() / crowdfund.BPS_DENOMINATOR();
  }

  function _assertStatus(uint256 id, ICrowdfund.Status expected) internal view {
    _assertStatus(id, expected, "unexpected campaign status");
  }

  function _assertStatus(uint256 id, ICrowdfund.Status expected, string memory message) internal view {
    assertEq(uint256(crowdfund.statusOf(id)), uint256(expected), message);
  }

  function _label(uint256 index) internal pure returns (string memory) {
    return string.concat("campaign ", vm.toString(index));
  }

  function _stringOfLength(uint256 length) internal pure returns (string memory) {
    bytes memory buffer = new bytes(length);
    for (uint256 i = 0; i < length; i++) {
      buffer[i] = "a";
    }
    return string(buffer);
  }
}

/// @notice A contract with no `receive`, so every ETH transfer to it fails. Used to prove that
///         `claimFunds`, `claimRefund` and `withdrawProtocolFees` revert instead of losing money.
contract RejectingAccount {
  Crowdfund internal immutable CROWDFUND;

  constructor(Crowdfund crowdfund) {
    CROWDFUND = crowdfund;
  }

  function createCampaign(string calldata title, uint256 goal, uint64 duration) external returns (uint256) {
    return CROWDFUND.createCampaign(title, goal, duration);
  }

  function back(uint256 id) external payable {
    CROWDFUND.contribute{value: msg.value}(id);
  }

  function claimFunds(uint256 id) external returns (uint256) {
    return CROWDFUND.claimFunds(id);
  }

  function claimRefund(uint256 id) external returns (uint256) {
    return CROWDFUND.claimRefund(id);
  }
}

/// @notice Owns its own `Crowdfund` (so it is the protocol owner) and refuses the fees.
contract RejectingOwner {
  Crowdfund public immutable crowdfund;

  constructor() {
    crowdfund = new Crowdfund();
  }

  function withdrawProtocolFees() external returns (uint256) {
    return crowdfund.withdrawProtocolFees();
  }
}

/// @notice Backs a campaign and tries to claim its refund twice, the second time from `receive`.
contract ReentrantBacker {
  Crowdfund internal immutable CROWDFUND;

  uint256 public campaignId;
  uint256 public reentryAttempts;
  bool public reentrySucceeded;

  constructor(Crowdfund crowdfund) {
    CROWDFUND = crowdfund;
  }

  function back(uint256 id) external payable {
    campaignId = id;
    CROWDFUND.contribute{value: msg.value}(id);
  }

  function claim() external {
    CROWDFUND.claimRefund(campaignId);
  }

  receive() external payable {
    if (reentryAttempts > 0) return;
    reentryAttempts += 1;

    // Swallow the revert on purpose: the point is to prove the second refund is refused, not to
    // blow up the outer transaction.
    try CROWDFUND.claimRefund(campaignId) {
      reentrySucceeded = true;
    } catch {}
  }
}

/// @notice Creates a campaign and tries to claim its funds twice, the second time from `receive`.
contract ReentrantCreator {
  Crowdfund internal immutable CROWDFUND;

  uint256 public campaignId;
  uint256 public reentryAttempts;
  bool public reentrySucceeded;

  constructor(Crowdfund crowdfund) {
    CROWDFUND = crowdfund;
  }

  function createCampaign(string calldata title, uint256 goal, uint64 duration) external returns (uint256 id) {
    id = CROWDFUND.createCampaign(title, goal, duration);
    campaignId = id;
  }

  function claim() external {
    CROWDFUND.claimFunds(campaignId);
  }

  receive() external payable {
    if (reentryAttempts > 0) return;
    reentryAttempts += 1;

    try CROWDFUND.claimFunds(campaignId) {
      reentrySucceeded = true;
    } catch {}
  }
}
