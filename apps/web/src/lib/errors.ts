import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from "viem";

import { formatDuration, formatEth } from "@/lib/format";

function asBigint(value: unknown): bigint | undefined {
  return typeof value === "bigint" ? value : undefined;
}

/** `ICrowdfund.Status` comes back from viem as the raw `uint8`. */
const CAMPAIGN_STATUS_LABELS = ["active", "successful", "failed"] as const;

function statusLabel(value: unknown): string | undefined {
  const index = typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : -1;
  return CAMPAIGN_STATUS_LABELS[index];
}

/**
 * Maps the custom errors declared by the exercise interfaces to human copy. One switch for the
 * whole lab: the error names are unique across `ICoffeeTipJar` and `ITodoList`, and a revert only
 * ever decodes against the ABI of the contract that was called.
 */
function describeCustomError(revert: ContractFunctionRevertedError): string | undefined {
  const args = revert.data?.args ?? [];

  switch (revert.data?.errorName) {
    case "NotOwner":
      return "Only the jar owner can run this action.";
    case "TipTooSmall": {
      const minimum = asBigint(args[1]);
      return minimum === undefined
        ? "Tip is below the minimum accepted by the contract."
        : `Tip is below the minimum of ${formatEth(minimum)} ETH.`;
    }
    case "NothingToWithdraw":
      return "The jar is empty — there is nothing to withdraw.";
    case "WithdrawFailed":
      return "The transfer to the owner failed. Does that address accept ETH?";
    case "NameTooLong": {
      const maxLength = asBigint(args[1]);
      return maxLength === undefined
        ? "Name is too long."
        : `Name is too long (max ${maxLength} bytes).`;
    }
    case "MessageTooLong": {
      const maxLength = asBigint(args[1]);
      return maxLength === undefined
        ? "Message is too long."
        : `Message is too long (max ${maxLength} bytes).`;
    }

    // --- ITodoList (exercise 02) ---
    case "EmptyContent":
      return "A task needs some text.";
    case "ContentTooLong": {
      const maxLength = asBigint(args[1]);
      return maxLength === undefined
        ? "The task text is too long."
        : `The task text is too long (max ${maxLength} bytes).`;
    }
    case "TaskNotFound":
      return "That task is not in your list — it may have been deleted already.";
    case "TaskLimitReached": {
      const limit = asBigint(args[0]);
      return limit === undefined
        ? "You have reached the maximum number of tasks."
        : `You already have the maximum of ${limit} tasks. Delete one first.`;
    }
    case "OffsetOutOfRange":
      return "That page starts past the end of the list.";

    // --- ICrowdfund (exercise 03) ---
    case "InvalidGoal":
      return "A campaign needs a goal greater than zero.";
    case "InvalidDuration": {
      const minDuration = asBigint(args[1]);
      const maxDuration = asBigint(args[2]);
      return minDuration === undefined || maxDuration === undefined
        ? "That campaign duration is out of range."
        : `The duration must be between ${formatDuration(minDuration)} and ${formatDuration(maxDuration)}.`;
    }
    case "EmptyTitle":
      return "A campaign needs a title.";
    case "TitleTooLong": {
      const maxLength = asBigint(args[1]);
      return maxLength === undefined
        ? "The campaign title is too long."
        : `The campaign title is too long (max ${maxLength} bytes).`;
    }
    case "CampaignNotFound":
      return "That campaign does not exist.";
    case "InvalidStatus": {
      const expected = statusLabel(args[1]);
      const actual = statusLabel(args[2]);
      return expected === undefined || actual === undefined
        ? "That action is not allowed at this point in the campaign."
        : `This campaign is ${actual}, and that action needs it to be ${expected}.`;
    }
    case "ZeroContribution":
      return "Attach some ETH to back a campaign.";
    case "NotCampaignCreator":
      return "Only the address that created the campaign can claim its funds.";
    case "AlreadyClaimed":
      return "This campaign has already paid out.";
    case "NothingToRefund":
      return "You have nothing to get back from this campaign.";
    case "NotProtocolOwner":
      return "Only the protocol owner can sweep the fees.";
    case "NoFeesToWithdraw":
      return "No protocol fees have accrued yet.";
    case "TransferFailed": {
      const amount = asBigint(args[1]);
      return amount === undefined
        ? "The ETH transfer failed. Does the destination address accept ETH?"
        : `Sending ${formatEth(amount)} ETH failed. Does the destination address accept ETH?`;
    }

    default:
      return undefined;
  }
}

/** Turns any wallet / RPC / revert failure into a single readable line for a toast. */
export function describeTxError(error: unknown): string {
  if (error === undefined || error === null) return "";

  if (error instanceof BaseError) {
    if (error.walk((cause) => cause instanceof UserRejectedRequestError)) {
      return "Transaction rejected in wallet.";
    }

    const revert = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      return describeCustomError(revert) ?? revert.reason ?? revert.shortMessage;
    }

    if (error.walk((cause) => cause instanceof InsufficientFundsError)) {
      return "Not enough ETH to cover the amount plus gas.";
    }

    return error.shortMessage.length > 0 ? error.shortMessage : error.message;
  }

  if (error instanceof Error && error.message.length > 0) return error.message;
  return "Unexpected error while sending the transaction.";
}
