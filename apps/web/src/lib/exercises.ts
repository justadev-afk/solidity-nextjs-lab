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
    slug: "02-todo-list",
    number: "02",
    title: "On-Chain Decentralized Todo List",
    summary:
      "No owner and no admin: every address keeps its own list of tasks, and removal has to be O(1) without ever losing a task.",
    concepts: [
      "msg.sender namespacing",
      "nested mappings",
      "dynamic arrays",
      "swap-and-pop",
      "index bookkeeping",
      "struct packing",
      "memory allocation",
      "pagination",
      "custom errors",
    ],
    status: "ready",
    contractPath: "packages/contracts/src/02-todo-list",
    href: "/exercises/02-todo-list",
  },
  {
    slug: "03-crowdfund",
    number: "03",
    title: "Crowdfund",
    summary:
      "A time-boxed funding goal: contributors get refunds when the campaign fails and the creator gets a single payout when it succeeds.",
    concepts: ["block.timestamp", "pull payments", "refund accounting", "reentrancy guard"],
    status: "planned",
    contractPath: "packages/contracts/src/03-crowdfund",
    href: "/exercises/03-crowdfund",
  },
  {
    slug: "04-erc20-token",
    number: "04",
    title: "ERC-20 Token",
    summary:
      "Implement the ERC-20 interface from scratch — balances, allowances and transfers — before reaching for a library.",
    concepts: ["ERC-20", "allowances", "nested mappings", "interfaces", "decimals"],
    status: "planned",
    contractPath: "packages/contracts/src/04-erc20-token",
    href: "/exercises/04-erc20-token",
  },
  {
    slug: "05-nft-mint",
    number: "05",
    title: "NFT Mint",
    summary:
      "A minimal ERC-721 with a paid public mint, a supply cap and per-wallet limits, plus token metadata.",
    concepts: ["ERC-721", "token URIs", "supply caps", "mint phases", "withdraw pattern"],
    status: "planned",
    contractPath: "packages/contracts/src/05-nft-mint",
    href: "/exercises/05-nft-mint",
  },
];
