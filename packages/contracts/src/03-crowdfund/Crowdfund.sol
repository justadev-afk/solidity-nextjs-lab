// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICrowdfund} from "./ICrowdfund.sol";

contract Crowdfund is ICrowdfund {
  uint256 public constant FEE_BPS = 200; // 2%, in basis points
  uint256 public constant BPS_DENOMINATOR = 10_000;
  uint64 public constant MIN_DURATION = 1 hours;
  uint64 public constant MAX_DURATION = 90 days;
  uint256 public constant MAX_TITLE_LENGTH = 80;

  // Properties
  uint256 private _ownerFees;
  address private immutable _owner;
  Campaign[] private _campaignList;
  mapping(address => uint256[]) private _userCampaigns;
  mapping(uint256 => mapping(address => uint256)) private _campaignPledges;
  mapping(uint256 => address[]) private _campaignContributors;
  mapping(uint256 => mapping(address => bool)) private _isContributor;

  constructor() {
    _owner = msg.sender;
  }

  // Getters

  /// @inheritdoc ICrowdfund
  function owner() external view returns (address) {
    return _owner;
  }

  /// @inheritdoc ICrowdfund
  function protocolFees() external view returns (uint256) {
    return _ownerFees;
  }

  function campaignCount() external view returns (uint256) {
    return _campaignList.length;
  }

  function getCampaign(uint256 id) external view campaignMustExists(id) returns (Campaign memory) {
    return _campaignList[id];
  }

  function getCampaigns(uint256 offset, uint256 limit) external view returns (Campaign[] memory response) {
    uint256 count = _campaignList.length;

    if (limit == 0 || offset >= count) {
      return new Campaign[](0);
    }

    uint256 size = count - offset;
    if (size > limit) {
      size = limit;
    }

    response = new Campaign[](size);

    for (uint256 i = 0; i < size;) {
      response[i] = _campaignList[offset + i];

      unchecked {
        ++i;
      }
    }
  }

  function campaignsOf(address creator) external view returns (uint256[] memory) {
    return _userCampaigns[creator];
  }

  function statusOf(uint256 id) external view campaignMustExists(id) returns (Status) {
    Campaign memory campaign = _campaignList[id];

    return _calculateCampaignStatus(campaign);
  }

  function contributionOf(uint256 id, address contributor) external view campaignMustExists(id) returns (uint256) {
    return _campaignPledges[id][contributor];
  }

  function backerCount(uint256 id) external view campaignMustExists(id) returns (uint256) {
    return _campaignContributors[id].length;
  }

  function createCampaign(string calldata title, uint256 goal, uint64 duration) external returns (uint256 id) {
    if (duration == 0 || duration > MAX_DURATION || duration < MIN_DURATION) {
      revert InvalidDuration(duration, MIN_DURATION, MAX_DURATION);
    }

    if (goal == 0) {
      revert InvalidGoal();
    }

    uint256 titleLength = bytes(title).length;
    if (titleLength == 0) {
      revert EmptyTitle();
    }

    if (titleLength > MAX_TITLE_LENGTH) {
      revert TitleTooLong(titleLength, MAX_TITLE_LENGTH);
    }

    address creator = msg.sender;

    Campaign memory campaign = Campaign({
      id: _campaignList.length,
      creator: creator,
      deadline: uint64(block.timestamp + duration),
      claimed: false,
      title: title,
      goal: goal,
      pledged: 0
    });

    _campaignList.push(campaign);
    _userCampaigns[creator].push(campaign.id);

    emit CampaignCreated(campaign.id, creator, title, goal, campaign.deadline);

    return campaign.id;
  }

  function contribute(uint256 id) external payable {
    if (msg.value == 0) {
      revert ZeroContribution();
    }

    address contributor = msg.sender;
    Campaign storage campaign = _getActiveCampaign(id);
    campaign.pledged += msg.value;

    _campaignPledges[id][contributor] += msg.value;

    if (!_isContributor[id][contributor]) {
      _isContributor[id][contributor] = true;
      _campaignContributors[campaign.id].push(contributor);
    }

    emit ContributionMade(id, msg.sender, msg.value, campaign.pledged);
  }

  function claimFunds(uint256 id) external returns (uint256 payout) {
    Campaign storage campaign = _getSuccessfulCampaign(id);

    if (campaign.creator != msg.sender) {
      revert NotCampaignCreator(id, msg.sender, campaign.creator);
    }

    if (campaign.claimed) {
      revert AlreadyClaimed(id);
    }

    campaign.claimed = true;
    uint256 fee = (campaign.pledged * FEE_BPS) / BPS_DENOMINATOR;
    payout = campaign.pledged - fee;
    _ownerFees += fee;

    (bool success,) = campaign.creator.call{value: payout}("");

    if (!success) {
      revert TransferFailed(campaign.creator, payout);
    }

    emit FundsClaimed(id, campaign.creator, payout, fee);
  }

  function claimRefund(uint256 id) external returns (uint256 amount) {
    _getFailedCampaign(id);

    address contributor = msg.sender;

    amount = _campaignPledges[id][contributor];
    if (!_isContributor[id][contributor] || amount == 0) {
      revert NothingToRefund(id, contributor);
    }

    (bool success,) = contributor.call{value: amount}("");

    if (!success) {
      revert TransferFailed(contributor, amount);
    }

    _campaignPledges[id][contributor] = 0;

    emit RefundIssued(id, contributor, amount);
  }

  function withdrawProtocolFees() external returns (uint256 amount) {
    if (msg.sender != _owner) {
      revert NotProtocolOwner(msg.sender, _owner);
    }

    if (_ownerFees == 0) {
      revert NoFeesToWithdraw();
    }
    amount = _ownerFees;

    (bool success,) = _owner.call{value: _ownerFees}("");
    _ownerFees = 0;

    if (!success) {
      revert TransferFailed(_owner, amount);
    }

    emit ProtocolFeesWithdrawn(_owner, amount);
  }

  // Helpers
  function _calculateCampaignStatus(Campaign memory campaign) private view returns (Status) {
    if (block.timestamp < campaign.deadline) {
      return Status.Active;
    }

    if (campaign.pledged >= campaign.goal) {
      return Status.Successful;
    }

    return Status.Failed;
  }

  function _getActiveCampaign(uint256 id) private view returns (Campaign storage) {
    return _getCampaignByIdWithStatus(id, Status.Active);
  }

  function _getSuccessfulCampaign(uint256 id) private view returns (Campaign storage) {
    return _getCampaignByIdWithStatus(id, Status.Successful);
  }

  function _getFailedCampaign(uint256 id) private view returns (Campaign storage) {
    return _getCampaignByIdWithStatus(id, Status.Failed);
  }

  function _getCampaignByIdWithStatus(uint256 id, Status status) private view returns (Campaign storage campaign) {
    campaign = _getCampaignById(id);
    Status campaignStatus = _calculateCampaignStatus(campaign);

    if (campaignStatus != status) {
      revert InvalidStatus(id, status, campaignStatus);
    }
  }

  function _getCampaignById(uint256 id) private view campaignMustExists(id) returns (Campaign storage) {
    return _campaignList[id];
  }

  // Modifiers
  modifier campaignMustExists(uint256 id) {
    if (id >= _campaignList.length) {
      revert CampaignNotFound(id);
    }

    _;
  }
}
