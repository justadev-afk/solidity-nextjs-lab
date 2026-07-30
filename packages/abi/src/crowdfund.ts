// Hand-written to mirror `ICrowdfund` exactly, so apps/web typechecks before the exercise
// contract compiles. `bun run abi:sync` overwrites it with the real artifact once the
// implementation exists. If you change ICrowdfund.sol, change this file in the same commit.

export const crowdfundAbi = [
  {
    type: "function",
    name: "backerCount",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "campaignCount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "campaignsOf",
    inputs: [
      {
        name: "creator",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256[]",
        internalType: "uint256[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimFunds",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "payout",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRefund",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "contribute",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "contributionOf",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "contributor",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createCampaign",
    inputs: [
      {
        name: "title",
        type: "string",
        internalType: "string",
      },
      {
        name: "goal",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "duration",
        type: "uint64",
        internalType: "uint64",
      },
    ],
    outputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getCampaign",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct ICrowdfund.Campaign",
        components: [
          {
            name: "id",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "creator",
            type: "address",
            internalType: "address",
          },
          {
            name: "deadline",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "claimed",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "title",
            type: "string",
            internalType: "string",
          },
          {
            name: "goal",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "pledged",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCampaigns",
    inputs: [
      {
        name: "offset",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "limit",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ICrowdfund.Campaign[]",
        components: [
          {
            name: "id",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "creator",
            type: "address",
            internalType: "address",
          },
          {
            name: "deadline",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "claimed",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "title",
            type: "string",
            internalType: "string",
          },
          {
            name: "goal",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "pledged",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "protocolFees",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "statusOf",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "enum ICrowdfund.Status",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawProtocolFees",
    inputs: [],
    outputs: [
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "CampaignCreated",
    inputs: [
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "creator",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "title",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "goal",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "deadline",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ContributionMade",
    inputs: [
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "contributor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "pledged",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FundsClaimed",
    inputs: [
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "creator",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "payout",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "fee",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ProtocolFeesWithdrawn",
    inputs: [
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RefundIssued",
    inputs: [
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "contributor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyClaimed",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "CampaignNotFound",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "EmptyTitle",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidDuration",
    inputs: [
      {
        name: "duration",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "minDuration",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "maxDuration",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidGoal",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidStatus",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "expected",
        type: "uint8",
        internalType: "enum ICrowdfund.Status",
      },
      {
        name: "actual",
        type: "uint8",
        internalType: "enum ICrowdfund.Status",
      },
    ],
  },
  {
    type: "error",
    name: "NoFeesToWithdraw",
    inputs: [],
  },
  {
    type: "error",
    name: "NotCampaignCreator",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "caller",
        type: "address",
        internalType: "address",
      },
      {
        name: "creator",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "NotProtocolOwner",
    inputs: [
      {
        name: "caller",
        type: "address",
        internalType: "address",
      },
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "NothingToRefund",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "contributor",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "TitleTooLong",
    inputs: [
      {
        name: "length",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "maxLength",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "ZeroContribution",
    inputs: [],
  },
] as const;

export type CrowdfundAbi = typeof crowdfundAbi;
