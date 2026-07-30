"use client";

import { useEffect, useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Megaphone } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TxStatus } from "@/components/web3/tx-status";
import {
  MAX_DURATION,
  MAX_TITLE_LENGTH,
  MIN_DURATION,
  useCrowdfundAddress,
  useCrowdfundWrite,
} from "@/hooks/use-crowdfund";
import { useMounted } from "@/hooks/use-mounted";
import { describeTxError } from "@/lib/errors";
import { byteLength, formatDuration, formatTimestamp } from "@/lib/format";

type NewCampaignValues = {
  title: string;
  goal: string;
  durationHours: string;
};

const DEFAULT_VALUES: NewCampaignValues = { title: "", goal: "", durationHours: "168" };

const SECONDS_PER_HOUR = 3_600n;
const MIN_HOURS = MIN_DURATION / SECONDS_PER_HOUR;
const MAX_HOURS = MAX_DURATION / SECONDS_PER_HOUR;

const DURATION_PRESETS: readonly { hours: string; label: string }[] = [
  { hours: "1", label: "1 hour" },
  { hours: "24", label: "1 day" },
  { hours: "168", label: "7 days" },
  { hours: "720", label: "30 days" },
  { hours: MAX_HOURS.toString(), label: "90 days" },
];

// The contract measures the title in bytes (`bytes(title).length`), not in code points, so the
// form validates the exact same way — see `byteLength`.
const campaignSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Give the campaign a name.")
      .refine(
        (value) => byteLength(value) <= MAX_TITLE_LENGTH,
        `Keep the title under ${MAX_TITLE_LENGTH} bytes.`,
      ),
    goal: z.string().min(1, "Set a funding goal in ETH."),
    durationHours: z.string().min(1, "Say how long the campaign runs."),
  })
  .superRefine((values, ctx) => {
    const rawGoal = values.goal.trim();
    if (!/^\d+(\.\d+)?$/.test(rawGoal)) {
      ctx.addIssue({ code: "custom", path: ["goal"], message: "That is not a valid ETH amount." });
    } else if (parseEther(rawGoal) === 0n) {
      ctx.addIssue({
        code: "custom",
        path: ["goal"],
        message: "The goal must be greater than zero.",
      });
    }

    const rawHours = values.durationHours.trim();
    if (!/^\d+$/.test(rawHours)) {
      ctx.addIssue({
        code: "custom",
        path: ["durationHours"],
        message: "Use a whole number of hours.",
      });
      return;
    }

    const hours = BigInt(rawHours);
    if (hours < MIN_HOURS || hours > MAX_HOURS) {
      ctx.addIssue({
        code: "custom",
        path: ["durationHours"],
        message: `Between ${MIN_HOURS.toString()} and ${MAX_HOURS.toString()} hours (${formatDuration(MIN_DURATION)} to ${formatDuration(MAX_DURATION)}).`,
      });
    }
  });

function submitLabel(isPending: boolean, isConfirming: boolean): string {
  if (isPending) return "Confirm in your wallet";
  if (isConfirming) return "Waiting for confirmation";
  return "Launch campaign";
}

export function NewCampaignForm() {
  const mounted = useMounted();
  const { isConnected } = useAccount();
  const { address: contractAddress, chainId } = useCrowdfundAddress();
  const { createCampaign, hash, isPending, isConfirming, isConfirmed, error } = useCrowdfundWrite();

  const resolver = useMemo<Resolver<NewCampaignValues>>(() => zodResolver(campaignSchema), []);

  const { register, handleSubmit, watch, setValue, reset, formState } = useForm<NewCampaignValues>({
    resolver,
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const { errors, isSubmitting } = formState;
  const titleValue = watch("title");
  const durationValue = watch("durationHours");
  const usedBytes = byteLength(titleValue);

  const settledHash = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isConfirmed || hash === undefined || settledHash.current === hash) return;
    settledHash.current = hash;
    toast.success("Campaign created", { description: "It is now open for contributions." });
    reset(DEFAULT_VALUES);
  }, [hash, isConfirmed, reset]);

  const isBusy = isPending || isConfirming || isSubmitting;
  const canSubmit = mounted && isConnected && Boolean(contractAddress);

  const previewDeadline = /^\d+$/.test(durationValue.trim())
    ? BigInt(Math.floor(Date.now() / 1000)) + BigInt(durationValue.trim()) * SECONDS_PER_HOUR
    : undefined;

  const onSubmit = async (values: NewCampaignValues) => {
    try {
      await createCampaign(
        values.title.trim(),
        values.goal.trim(),
        BigInt(values.durationHours.trim()) * SECONDS_PER_HOUR,
      );
    } catch (submitError) {
      toast.error(describeTxError(submitError));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Launch a campaign</CardTitle>
        <CardDescription>
          There is no gatekeeper: any address can open any number of campaigns. The deadline is
          fixed at creation as <code className="font-mono">block.timestamp + duration</code> and can
          never be moved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="campaign-title">Title</Label>
              <span
                className={
                  usedBytes > MAX_TITLE_LENGTH
                    ? "text-xs text-destructive tabular-nums"
                    : "text-xs text-muted-foreground tabular-nums"
                }
              >
                {usedBytes}/{MAX_TITLE_LENGTH} bytes
              </span>
            </div>
            <Input
              id="campaign-title"
              placeholder="Fund the community node"
              autoComplete="off"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "campaign-title-error" : undefined}
              disabled={isBusy}
              {...register("title")}
            />
            {errors.title ? (
              <p id="campaign-title-error" role="alert" className="text-xs text-destructive">
                {errors.title.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-goal">Goal (ETH)</Label>
            <Input
              id="campaign-goal"
              inputMode="decimal"
              placeholder="10"
              autoComplete="off"
              aria-invalid={errors.goal ? true : undefined}
              aria-describedby={errors.goal ? "campaign-goal-error" : "campaign-goal-hint"}
              disabled={isBusy}
              {...register("goal")}
            />
            {errors.goal ? (
              <p id="campaign-goal-error" role="alert" className="text-xs text-destructive">
                {errors.goal.message}
              </p>
            ) : (
              <p id="campaign-goal-hint" className="text-xs text-muted-foreground">
                Reaching it is judged once, at the deadline. Backers may overshoot it.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-duration">Duration (hours)</Label>
            <Input
              id="campaign-duration"
              inputMode="numeric"
              placeholder="168"
              autoComplete="off"
              aria-invalid={errors.durationHours ? true : undefined}
              aria-describedby={
                errors.durationHours ? "campaign-duration-error" : "campaign-duration-hint"
              }
              disabled={isBusy}
              {...register("durationHours")}
            />
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <Button
                  key={preset.hours}
                  type="button"
                  size="sm"
                  variant={durationValue.trim() === preset.hours ? "default" : "outline"}
                  aria-pressed={durationValue.trim() === preset.hours}
                  disabled={isBusy}
                  onClick={() =>
                    setValue("durationHours", preset.hours, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {errors.durationHours ? (
              <p id="campaign-duration-error" role="alert" className="text-xs text-destructive">
                {errors.durationHours.message}
              </p>
            ) : (
              <p id="campaign-duration-hint" className="text-xs text-muted-foreground">
                {previewDeadline === undefined
                  ? `Between ${formatDuration(MIN_DURATION)} and ${formatDuration(MAX_DURATION)}.`
                  : `Closes around ${formatTimestamp(previewDeadline)}.`}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button type="submit" className="w-full" disabled={isBusy || !canSubmit}>
              {isBusy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Megaphone className="size-4" aria-hidden="true" />
              )}
              {submitLabel(isPending || isSubmitting, isConfirming)}
            </Button>

            {mounted && !isConnected ? (
              <p className="text-center text-xs text-muted-foreground">
                Connect your wallet to launch a campaign.
              </p>
            ) : null}

            {mounted && isConnected && !contractAddress ? (
              <p className="text-center text-xs text-muted-foreground">
                No Crowdfund address resolved yet — deploy the contract first.
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
