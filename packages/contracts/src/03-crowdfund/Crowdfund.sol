// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICrowdfund} from "./ICrowdfund.sol";

contract Crowdfund is ICrowdfund {
  uint256 public constant FEE_BPS = 200; // 2%, in basis points
  uint256 public constant BPS_DENOMINATOR = 10_000;
  uint64 public constant MIN_DURATION = 1 hours;
  uint64 public constant MAX_DURATION = 90 days;
  uint256 public constant MAX_TITLE_LENGTH = 80;

  // your code here
}
