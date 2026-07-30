"use client";

import { useEffect, useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Send } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TxStatus } from "@/components/web3/tx-status";
import { useCoffeeTipJarAddress, useJarStats, useTipJarWrite } from "@/hooks/use-coffee-tip-jar";
import { useMounted } from "@/hooks/use-mounted";
import { describeTxError } from "@/lib/errors";
import { formatEthWithUnit } from "@/lib/format";

const MAX_NAME_LENGTH = 32;
const MAX_MESSAGE_LENGTH = 280;
const DECIMAL_AMOUNT = /^\d*\.?\d+$/;

const PRESETS = [
  { label: "☕ 0.001", value: "0.001" },
  { label: "🍩 0.005", value: "0.005" },
  { label: "🍕 0.01", value: "0.01" },
] as const;

type TipFormValues = {
  name: string;
  amount: string;
  message: string;
};

const DEFAULT_VALUES: TipFormValues = { name: "", amount: "", message: "" };

function createTipSchema(minimumTip: bigint | undefined) {
  return z
    .object({
      name: z.string().max(MAX_NAME_LENGTH, `Keep the name under ${MAX_NAME_LENGTH} characters.`),
      amount: z.string().min(1, "Enter how much ETH you want to send."),
      message: z
        .string()
        .trim()
        .min(1, "Write a short message for the owner.")
        .max(MAX_MESSAGE_LENGTH, `Keep the message under ${MAX_MESSAGE_LENGTH} characters.`),
    })
    .superRefine((values, ctx) => {
      const raw = values.amount.trim();

      if (!DECIMAL_AMOUNT.test(raw)) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: "Use a plain decimal number, for example 0.005.",
        });
        return;
      }

      let wei: bigint;
      try {
        wei = parseEther(raw);
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: "That is not a valid ETH amount.",
        });
        return;
      }

      if (wei <= 0n) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: "The amount must be greater than zero.",
        });
        return;
      }

      if (minimumTip !== undefined && wei < minimumTip) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: `The minimum tip is ${formatEthWithUnit(minimumTip)}.`,
        });
      }
    });
}

function submitLabel(isPending: boolean, isConfirming: boolean): string {
  if (isPending) return "Confirm in your wallet";
  if (isConfirming) return "Waiting for confirmation";
  return "Send tip";
}

export function TipForm() {
  const mounted = useMounted();
  const { address: account, isConnected } = useAccount();
  const { address: contractAddress, chainId } = useCoffeeTipJarAddress();
  const { minimumTip } = useJarStats();
  const { tip, hash, isPending, isConfirming, isConfirmed, error } = useTipJarWrite();

  const resolver = useMemo<Resolver<TipFormValues>>(
    () => zodResolver(createTipSchema(minimumTip)),
    [minimumTip],
  );

  const { register, handleSubmit, setValue, watch, reset, getValues, formState } =
    useForm<TipFormValues>({
      resolver,
      defaultValues: DEFAULT_VALUES,
      mode: "onBlur",
    });

  const { errors, isSubmitting } = formState;
  const nameValue = watch("name");
  const amountValue = watch("amount");
  const messageValue = watch("message");

  const settledHash = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isConfirmed || hash === undefined || settledHash.current === hash) return;
    settledHash.current = hash;
    toast.success("Tip sent — thanks for the coffee!", {
      description: "Your message is now stored on-chain.",
    });
    // Keep the supporter name around so tipping twice stays quick.
    reset({ ...DEFAULT_VALUES, name: getValues("name") });
  }, [getValues, hash, isConfirmed, reset]);

  const isBusy = isPending || isConfirming || isSubmitting;
  const canSubmit = mounted && isConnected && Boolean(account) && Boolean(contractAddress);

  const onSubmit = async (values: TipFormValues) => {
    try {
      await tip({
        name: values.name.trim(),
        message: values.message.trim(),
        valueEth: values.amount.trim(),
      });
    } catch (submitError) {
      toast.error(describeTxError(submitError));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buy the owner a coffee</CardTitle>
        <CardDescription>
          Send ETH with a name and a message. Both are stored on-chain, so keep them short.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="tip-name">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {nameValue.length}/{MAX_NAME_LENGTH}
              </span>
            </div>
            <Input
              id="tip-name"
              placeholder="Anonymous"
              autoComplete="off"
              maxLength={MAX_NAME_LENGTH}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "tip-name-error" : "tip-name-hint"}
              disabled={isBusy}
              {...register("name")}
            />
            {errors.name ? (
              <p id="tip-name-error" role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            ) : (
              <p id="tip-name-hint" className="text-xs text-muted-foreground">
                Leave it empty to show up as Anonymous.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tip-amount">Amount (ETH)</Label>
            <Input
              id="tip-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder={minimumTip === undefined ? "0.001" : formatEthWithUnit(minimumTip)}
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={errors.amount ? "tip-amount-error" : "tip-amount-hint"}
              disabled={isBusy}
              {...register("amount")}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  size="sm"
                  variant={amountValue.trim() === preset.value ? "default" : "outline"}
                  aria-pressed={amountValue.trim() === preset.value}
                  disabled={isBusy}
                  onClick={() =>
                    setValue("amount", preset.value, { shouldValidate: true, shouldDirty: true })
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {errors.amount ? (
              <p id="tip-amount-error" role="alert" className="text-xs text-destructive">
                {errors.amount.message}
              </p>
            ) : (
              <p id="tip-amount-hint" className="text-xs text-muted-foreground">
                {minimumTip === undefined
                  ? "The contract enforces a minimum tip."
                  : `Minimum enforced on-chain: ${formatEthWithUnit(minimumTip)}.`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="tip-message">Message</Label>
              <span
                className={
                  messageValue.length > MAX_MESSAGE_LENGTH
                    ? "text-xs text-destructive tabular-nums"
                    : "text-xs text-muted-foreground tabular-nums"
                }
              >
                {messageValue.length}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>
            <Textarea
              id="tip-message"
              rows={3}
              placeholder="Great work on the lab — keep shipping!"
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={errors.message ? "tip-message-error" : undefined}
              disabled={isBusy}
              {...register("message")}
            />
            {errors.message ? (
              <p id="tip-message-error" role="alert" className="text-xs text-destructive">
                {errors.message.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <Button type="submit" className="w-full" disabled={isBusy || !canSubmit}>
              {isBusy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              {submitLabel(isPending || isSubmitting, isConfirming)}
            </Button>

            {mounted && !isConnected ? (
              <p className="text-center text-xs text-muted-foreground">
                Connect your wallet to send a tip.
              </p>
            ) : null}

            {mounted && isConnected && !contractAddress ? (
              <p className="text-center text-xs text-muted-foreground">
                No jar address resolved yet — deploy the contract first.
              </p>
            ) : null}

            <TxStatus
              hash={hash}
              isPending={isPending}
              isConfirming={isConfirming}
              isConfirmed={isConfirmed}
              error={error}
              chainId={chainId}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
