import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from "viem";

import { formatEth } from "@/lib/format";

function asBigint(value: unknown): bigint | undefined {
  return typeof value === "bigint" ? value : undefined;
}

/** Maps the custom errors declared by `ICoffeeTipJar` to human copy. */
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
