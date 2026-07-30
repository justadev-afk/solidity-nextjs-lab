// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// NOTE: this file does NOT compile until you implement `src/01-coffee-tip-jar/CoffeeTipJar.sol`.
// That file ships as an empty `contract CoffeeTipJar is ICoffeeTipJar {}`, so the first error you
// see is `Contract "CoffeeTipJar" should be marked as abstract` — every interface function is
// still missing. A failing `forge build` / `forge test` is the intended starting point of the
// exercise: red -> green. Every test below maps to one of the behavioural rules in the exercise
// brief (`src/01-coffee-tip-jar/README.md`).

import {CoffeeTipJar} from "../../src/01-coffee-tip-jar/CoffeeTipJar.sol";
import {ICoffeeTipJar} from "../../src/01-coffee-tip-jar/ICoffeeTipJar.sol";
import {Test, console2} from "forge-std/Test.sol";

contract CoffeeTipJarTest is Test {
    uint256 internal constant INITIAL_MINIMUM_TIP = 0.001 ether;
    uint256 internal constant START_TIMESTAMP = 1_700_000_000;

    CoffeeTipJar internal jar;

    address internal owner;
    address internal alice;
    address internal bob;

    function setUp() public {
        vm.warp(START_TIMESTAMP);

        owner = makeAddr("owner");
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        vm.prank(owner);
        jar = new CoffeeTipJar(INITIAL_MINIMUM_TIP);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ---------------------------------------------------------------------------------------
    // Constructor and constants
    // ---------------------------------------------------------------------------------------

    function test_Constructor_SetsOwnerAndMinimumTip() public view {
        assertEq(jar.owner(), owner, "owner must be the deployer");
        assertEq(jar.minimumTip(), INITIAL_MINIMUM_TIP, "minimumTip must come from the constructor");
    }

    function test_Constructor_StartsEmpty() public view {
        assertEq(jar.totalTipped(), 0);
        assertEq(jar.tipCount(), 0);
        assertEq(jar.getTips().length, 0);
        assertEq(address(jar).balance, 0);
    }

    function test_Constants_MatchTheBrief() public view {
        assertEq(jar.MAX_NAME_LENGTH(), 32, "MAX_NAME_LENGTH must be 32");
        assertEq(jar.MAX_MESSAGE_LENGTH(), 280, "MAX_MESSAGE_LENGTH must be 280");
    }

    // ---------------------------------------------------------------------------------------
    // Rule 1 — tip reverts below the minimum
    // ---------------------------------------------------------------------------------------

    function test_Tip_RevertsWhenValueBelowMinimum() public {
        uint256 value = INITIAL_MINIMUM_TIP - 1;

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.TipTooSmall.selector, value, INITIAL_MINIMUM_TIP));
        vm.prank(alice);
        jar.tip{value: value}("alice", "too cheap");
    }

    function test_Tip_RevertsWithoutValue() public {
        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.TipTooSmall.selector, 0, INITIAL_MINIMUM_TIP));
        vm.prank(alice);
        jar.tip("alice", "free coffee?");
    }

    function test_Tip_AcceptsExactMinimum() public {
        vm.prank(alice);
        jar.tip{value: INITIAL_MINIMUM_TIP}("alice", "exactly the minimum");

        assertEq(jar.tipCount(), 1);
        assertEq(address(jar).balance, INITIAL_MINIMUM_TIP);
    }

    // ---------------------------------------------------------------------------------------
    // Rules 2 and 3 — name and message length limits
    // ---------------------------------------------------------------------------------------

    function test_Tip_RevertsWhenNameTooLong() public {
        uint256 maxLength = jar.MAX_NAME_LENGTH();
        string memory name = _stringOfLength(maxLength + 1);

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.NameTooLong.selector, maxLength + 1, maxLength));
        vm.prank(alice);
        jar.tip{value: 1 ether}(name, "gm");
    }

    function test_Tip_AcceptsNameOfMaxLength() public {
        string memory name = _stringOfLength(jar.MAX_NAME_LENGTH());

        vm.prank(alice);
        jar.tip{value: INITIAL_MINIMUM_TIP}(name, "gm");

        assertEq(jar.getTip(0).name, name);
    }

    function test_Tip_RevertsWhenMessageTooLong() public {
        uint256 maxLength = jar.MAX_MESSAGE_LENGTH();
        string memory message = _stringOfLength(maxLength + 1);

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.MessageTooLong.selector, maxLength + 1, maxLength));
        vm.prank(alice);
        jar.tip{value: 1 ether}("alice", message);
    }

    function test_Tip_AcceptsMessageOfMaxLength() public {
        string memory message = _stringOfLength(jar.MAX_MESSAGE_LENGTH());

        vm.prank(alice);
        jar.tip{value: INITIAL_MINIMUM_TIP}("alice", message);

        assertEq(jar.getTip(0).message, message);
    }

    // ---------------------------------------------------------------------------------------
    // Rule 4 — an empty name is allowed (the UI renders it as "Anonymous")
    // ---------------------------------------------------------------------------------------

    function test_Tip_AllowsEmptyName() public {
        vm.prank(alice);
        jar.tip{value: INITIAL_MINIMUM_TIP}("", "anonymous coffee");

        ICoffeeTipJar.Tip memory stored = jar.getTip(0);
        assertEq(stored.name, "");
        assertEq(stored.from, alice);
    }

    // ---------------------------------------------------------------------------------------
    // Rule 5 — accounting, storage and the TipReceived event
    // ---------------------------------------------------------------------------------------

    function test_Tip_UpdatesAccounting() public {
        _tip(alice, 0.01 ether);
        _tip(bob, 0.02 ether);
        _tip(alice, 0.03 ether);

        assertEq(jar.tipCount(), 3);
        assertEq(jar.totalTipped(), 0.06 ether);
        assertEq(jar.tipsOf(alice), 0.04 ether, "tipsOf must accumulate per supporter");
        assertEq(jar.tipsOf(bob), 0.02 ether);
        assertEq(jar.tipsOf(makeAddr("stranger")), 0);
        assertEq(address(jar).balance, 0.06 ether);
    }

    function test_Tip_StoresTipsInArrivalOrder() public {
        vm.prank(alice);
        jar.tip{value: 0.01 ether}("alice", "first");

        vm.warp(START_TIMESTAMP + 60);
        vm.prank(bob);
        jar.tip{value: 0.02 ether}("bob", "second");

        ICoffeeTipJar.Tip[] memory tips = jar.getTips();
        assertEq(tips.length, 2);

        assertEq(tips[0].from, alice);
        assertEq(tips[0].amount, 0.01 ether);
        assertEq(tips[0].name, "alice");
        assertEq(tips[0].message, "first");
        assertEq(tips[0].timestamp, START_TIMESTAMP);

        assertEq(tips[1].from, bob);
        assertEq(tips[1].amount, 0.02 ether);
        assertEq(tips[1].timestamp, START_TIMESTAMP + 60);
        assertEq(jar.getTip(1).message, "second");
    }

    function test_Tip_EmitsTipReceived() public {
        vm.expectEmit(address(jar));
        emit ICoffeeTipJar.TipReceived(alice, 0.01 ether, "alice", "gm", START_TIMESTAMP);

        vm.prank(alice);
        jar.tip{value: 0.01 ether}("alice", "gm");
    }

    // ---------------------------------------------------------------------------------------
    // Rules 6, 7 and 8 — withdraw
    // ---------------------------------------------------------------------------------------

    function test_Withdraw_RevertsForNonOwner() public {
        _tip(alice, 1 ether);

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.NotOwner.selector, alice));
        vm.prank(alice);
        jar.withdraw();

        assertEq(address(jar).balance, 1 ether, "a failed withdraw must not move funds");
    }

    function test_Withdraw_RevertsWhenNothingToWithdraw() public {
        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.NothingToWithdraw.selector));
        vm.prank(owner);
        jar.withdraw();
    }

    function test_Withdraw_RevertsOnSecondWithdrawal() public {
        _tip(alice, 1 ether);

        vm.prank(owner);
        jar.withdraw();

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.NothingToWithdraw.selector));
        vm.prank(owner);
        jar.withdraw();
    }

    function test_Withdraw_SendsFullBalanceToOwnerAndEmits() public {
        _tip(alice, 1 ether);
        _tip(bob, 2 ether);

        uint256 ownerBalanceBefore = owner.balance;

        vm.expectEmit(address(jar));
        emit ICoffeeTipJar.Withdrawn(owner, 3 ether);

        vm.prank(owner);
        jar.withdraw();

        assertEq(address(jar).balance, 0, "the jar must be emptied");
        assertEq(owner.balance, ownerBalanceBefore + 3 ether, "the owner must receive everything");
    }

    function test_Withdraw_KeepsCumulativeHistory() public {
        _tip(alice, 1 ether);

        vm.prank(owner);
        jar.withdraw();

        assertEq(jar.totalTipped(), 1 ether, "totalTipped is cumulative, a withdrawal must not reset it");
        assertEq(jar.tipCount(), 1);
        assertEq(jar.tipsOf(alice), 1 ether);
        assertEq(jar.getTips().length, 1);
    }

    /// @dev `RejectingOwner` has no `receive`/`fallback`, so the low-level call must fail.
    ///      This also rules out `transfer`/`send`, whose 2300 gas stipend would revert the
    ///      whole transaction instead of surfacing `WithdrawFailed`.
    function test_Withdraw_RevertsWhenOwnerRejectsEther() public {
        RejectingOwner rejecting = new RejectingOwner();
        CoffeeTipJar hostileJar = rejecting.deployJar(INITIAL_MINIMUM_TIP);

        vm.prank(alice);
        hostileJar.tip{value: 1 ether}("alice", "gm");

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.WithdrawFailed.selector));
        rejecting.withdrawFromJar();

        assertEq(address(hostileJar).balance, 1 ether, "funds must stay in the jar");
    }

    // ---------------------------------------------------------------------------------------
    // Rule 9 — setMinimumTip
    // ---------------------------------------------------------------------------------------

    function test_SetMinimumTip_UpdatesValueAndEmits() public {
        vm.expectEmit(address(jar));
        emit ICoffeeTipJar.MinimumTipUpdated(INITIAL_MINIMUM_TIP, 0.5 ether);

        vm.prank(owner);
        jar.setMinimumTip(0.5 ether);

        assertEq(jar.minimumTip(), 0.5 ether);
    }

    function test_SetMinimumTip_RevertsForNonOwner() public {
        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.NotOwner.selector, bob));
        vm.prank(bob);
        jar.setMinimumTip(1 wei);

        assertEq(jar.minimumTip(), INITIAL_MINIMUM_TIP);
    }

    function test_SetMinimumTip_IsEnforcedByTip() public {
        vm.prank(owner);
        jar.setMinimumTip(1 ether);

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.TipTooSmall.selector, 0.5 ether, 1 ether));
        vm.prank(alice);
        jar.tip{value: 0.5 ether}("alice", "not enough any more");
    }

    function test_SetMinimumTip_ZeroAllowsFreeTips() public {
        vm.prank(owner);
        jar.setMinimumTip(0);

        vm.prank(alice);
        jar.tip("alice", "just saying hi");

        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), 0);
    }

    // ---------------------------------------------------------------------------------------
    // Rule 10 — getTip out of range
    // ---------------------------------------------------------------------------------------

    function test_GetTip_RevertsWhenIndexOutOfRange() public {
        _tip(alice, 1 ether);

        // A plain array access panics with 0x32; any revert is acceptable here.
        vm.expectRevert();
        jar.getTip(1);
    }

    function test_GetTip_RevertsWhenJarIsEmpty() public {
        vm.expectRevert();
        jar.getTip(0);
    }

    // ---------------------------------------------------------------------------------------
    // Rule 11 — reentrancy
    // ---------------------------------------------------------------------------------------

    /// @dev The attacker owns the jar, so `withdraw` re-enters through its `receive`. Ether is
    ///      moved before the callee runs, so the re-entrant call must see a zero balance and
    ///      revert with `NothingToWithdraw`.
    ///
    ///      Asserting that exact revert reason is what gives this test teeth. An implementation
    ///      that book-keeps an internal "withdrawable" amount and clears it only AFTER the
    ///      external call still holds a stale non-zero amount when it is re-entered: it tries to
    ///      send ether it no longer has and reverts with `WithdrawFailed` instead. Without the
    ///      revert-reason check that broken version passes, because the attacker swallows the
    ///      revert in its `catch` and every balance assertion below still holds.
    function test_Withdraw_IsSafeAgainstReentrancy() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker();
        CoffeeTipJar victim = attacker.deployJar(INITIAL_MINIMUM_TIP);

        vm.prank(alice);
        victim.tip{value: 2 ether}("alice", "gm");
        vm.prank(bob);
        victim.tip{value: 3 ether}("bob", "gm");

        attacker.withdrawFromJar();

        console2.log("reentrancy attempts:", attacker.reentryAttempts());

        assertGt(attacker.reentryAttempts(), 0, "the attacker never re-entered, test is meaningless");
        assertEq(attacker.successfulReentries(), 0, "a re-entrant withdraw must not succeed");
        assertEq(
            attacker.lastReentryError(),
            abi.encodeWithSelector(ICoffeeTipJar.NothingToWithdraw.selector),
            "the re-entrant withdraw must see an empty jar: move the ether last, book-keep nothing"
        );
        assertEq(address(victim).balance, 0, "the jar must be emptied exactly once");
        assertEq(address(attacker).balance, 5 ether, "the owner must not receive more than the jar held");
        assertEq(victim.totalTipped(), 5 ether);
        assertEq(victim.tipCount(), 2);
    }

    // ---------------------------------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------------------------------

    function testFuzz_TipStoresAmount(uint96 amount) public {
        uint256 value = bound(uint256(amount), INITIAL_MINIMUM_TIP, 1_000 ether);
        address supporter = makeAddr("fuzzSupporter");
        vm.deal(supporter, value);

        vm.prank(supporter);
        jar.tip{value: value}("fuzz", "fuzzed coffee");

        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), value);
        assertEq(jar.tipsOf(supporter), value);
        assertEq(address(jar).balance, value);

        ICoffeeTipJar.Tip memory stored = jar.getTip(0);
        assertEq(stored.from, supporter);
        assertEq(stored.amount, value);
        assertEq(stored.timestamp, START_TIMESTAMP);
    }

    function testFuzz_RejectsBelowMinimum(uint96 amount) public {
        uint256 value = bound(uint256(amount), 0, INITIAL_MINIMUM_TIP - 1);
        address supporter = makeAddr("cheapSupporter");
        vm.deal(supporter, INITIAL_MINIMUM_TIP);

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.TipTooSmall.selector, value, INITIAL_MINIMUM_TIP));
        vm.prank(supporter);
        jar.tip{value: value}("cheap", "not enough");

        assertEq(jar.tipCount(), 0);
        assertEq(jar.totalTipped(), 0);
        assertEq(address(jar).balance, 0);
    }

    function testFuzz_AcceptsAnyNameUpToMax(uint8 nameLength) public {
        uint256 length = bound(uint256(nameLength), 0, jar.MAX_NAME_LENGTH());
        string memory name = _stringOfLength(length);

        vm.prank(alice);
        jar.tip{value: INITIAL_MINIMUM_TIP}(name, "gm");

        assertEq(jar.getTip(0).name, name);
    }

    function testFuzz_RejectsMessageLongerThanMax(uint16 extra) public {
        uint256 maxLength = jar.MAX_MESSAGE_LENGTH();
        uint256 length = maxLength + 1 + bound(uint256(extra), 0, 512);
        string memory message = _stringOfLength(length);

        vm.expectRevert(abi.encodeWithSelector(ICoffeeTipJar.MessageTooLong.selector, length, maxLength));
        vm.prank(alice);
        jar.tip{value: INITIAL_MINIMUM_TIP}("alice", message);
    }

    // ---------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------

    function _tip(address supporter, uint256 value) internal {
        vm.deal(supporter, supporter.balance + value);
        vm.prank(supporter);
        jar.tip{value: value}("supporter", "thanks for the coffee");
    }

    function _stringOfLength(uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            buffer[i] = "a";
        }
        return string(buffer);
    }
}

/// @notice Owner without `receive`/`fallback`: any plain ether transfer to it fails.
contract RejectingOwner {
    CoffeeTipJar internal jar;

    function deployJar(uint256 minimumTip) external returns (CoffeeTipJar) {
        jar = new CoffeeTipJar(minimumTip);
        return jar;
    }

    function withdrawFromJar() external {
        jar.withdraw();
    }
}

/// @notice Owner that tries to re-enter `withdraw` while receiving its own payout.
contract ReentrancyAttacker {
    CoffeeTipJar internal jar;

    uint256 public reentryAttempts;
    uint256 public successfulReentries;
    /// @notice Raw revert data of the last re-entrant `withdraw`, so the test can assert WHY it failed.
    bytes public lastReentryError;

    function deployJar(uint256 minimumTip) external returns (CoffeeTipJar) {
        jar = new CoffeeTipJar(minimumTip);
        return jar;
    }

    function withdrawFromJar() external {
        jar.withdraw();
    }

    receive() external payable {
        // Bounded so a vulnerable implementation fails an assertion instead of running out of gas.
        if (reentryAttempts >= 3) {
            return;
        }
        reentryAttempts++;

        try jar.withdraw() {
            successfulReentries++;
        } catch (bytes memory reason) {
            lastReentryError = reason;
        }
    }
}
