export type ExerciseStatus = "ready" | "wip" | "planned";

export type Exercise = {
  slug: string;
  number: string;
  title: string;
  summary: string;
  concepts: string[];
  status: ExerciseStatus;
  /** Folder holding the interface, the brief and the implementation you write. */
  contractPath: string;
  href: string;
};

/**
 * Registry of the lab. Only `ready` (and `wip`) exercises have a real page — `planned`
 * entries are rendered as non-clickable cards on the index.
 */
export const exercises: Exercise[] = [
  {
    slug: "01-coffee-tip-jar",
    number: "01",
    title: "Coffee Tip Jar",
    summary:
      "Accept ETH tips with a name and a message, keep the supporter ledger on-chain and let only the owner withdraw the balance.",
    concepts: [
      "payable",
      "msg.sender / msg.value",
      "structs",
      "dynamic arrays",
      "mappings",
      "events",
      "custom errors",
      "access control",
      "low-level call",
    ],
    status: "ready",
    contractPath: "packages/contracts/src/01-coffee-tip-jar",
    href: "/exercises/01-coffee-tip-jar",
  },
  {
    slug: "02-crowdfund",
    number: "02",
    title: "Crowdfund",
    summary:
      "A time-boxed funding goal: contributors get refunds when the campaign fails and the creator gets a single payout when it succeeds.",
    concepts: ["block.timestamp", "pull payments", "refund accounting", "reentrancy guard"],
    status: "planned",
    contractPath: "packages/contracts/src/02-crowdfund",
    href: "/exercises/02-crowdfund",
  },
  {
    slug: "03-erc20-token",
    number: "03",
    title: "ERC-20 Token",
    summary:
      "Implement the ERC-20 interface from scratch — balances, allowances and transfers — before reaching for a library.",
    concepts: ["ERC-20", "allowances", "nested mappings", "interfaces", "decimals"],
    status: "planned",
    contractPath: "packages/contracts/src/03-erc20-token",
    href: "/exercises/03-erc20-token",
  },
  {
    slug: "04-nft-mint",
    number: "04",
    title: "NFT Mint",
    summary:
      "A minimal ERC-721 with a paid public mint, a supply cap and per-wallet limits, plus token metadata.",
    concepts: ["ERC-721", "token URIs", "supply caps", "mint phases", "withdraw pattern"],
    status: "planned",
    contractPath: "packages/contracts/src/04-nft-mint",
    href: "/exercises/04-nft-mint",
  },
];
