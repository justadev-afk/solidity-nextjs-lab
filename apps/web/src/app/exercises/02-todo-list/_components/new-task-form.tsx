"use client";

import { useEffect, useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TxStatus } from "@/components/web3/tx-status";
import { useMounted } from "@/hooks/use-mounted";
import {
  MAX_CONTENT_LENGTH,
  MAX_TASKS_PER_OWNER,
  useListOwner,
  useListStats,
  useTodoListAddress,
  useTodoListWrite,
} from "@/hooks/use-todo-list";
import { describeTxError } from "@/lib/errors";
import { byteLength } from "@/lib/format";

type NewTaskValues = { content: string };

const DEFAULT_VALUES: NewTaskValues = { content: "" };

// The contract measures the content in bytes (`bytes(content).length`), not in code points, so the
// form validates the exact same way — see `byteLength`.
const taskSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write what you have to do.")
    .refine(
      (value) => byteLength(value) <= MAX_CONTENT_LENGTH,
      `Keep the task under ${MAX_CONTENT_LENGTH} bytes.`,
    ),
});

function submitLabel(isPending: boolean, isConfirming: boolean): string {
  if (isPending) return "Confirm in your wallet";
  if (isConfirming) return "Waiting for confirmation";
  return "Add task";
}

export function NewTaskForm() {
  const mounted = useMounted();
  const { isConnected } = useAccount();
  const owner = useListOwner();
  const { address: contractAddress, chainId } = useTodoListAddress();
  const { taskCount } = useListStats(owner);
  const { createTask, hash, isPending, isConfirming, isConfirmed, error } = useTodoListWrite();

  const resolver = useMemo<Resolver<NewTaskValues>>(() => zodResolver(taskSchema), []);

  const { register, handleSubmit, watch, reset, formState } = useForm<NewTaskValues>({
    resolver,
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const { errors, isSubmitting } = formState;
  const contentValue = watch("content");
  const usedBytes = byteLength(contentValue);

  const settledHash = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isConfirmed || hash === undefined || settledHash.current === hash) return;
    settledHash.current = hash;
    toast.success("Task created", { description: "It now lives in your on-chain list." });
    reset(DEFAULT_VALUES);
  }, [hash, isConfirmed, reset]);

  const isFull = taskCount !== undefined && taskCount >= BigInt(MAX_TASKS_PER_OWNER);
  const isBusy = isPending || isConfirming || isSubmitting;
  const canSubmit = mounted && isConnected && Boolean(contractAddress) && !isFull;

  const onSubmit = async (values: NewTaskValues) => {
    try {
      await createTask(values.content.trim());
    } catch (submitError) {
      toast.error(describeTxError(submitError));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a task</CardTitle>
        <CardDescription>
          Stored on-chain under your address. Nobody else can edit or delete it — not even whoever
          deployed the contract.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="task-content">Task</Label>
              <span
                className={
                  usedBytes > MAX_CONTENT_LENGTH
                    ? "text-xs text-destructive tabular-nums"
                    : "text-xs text-muted-foreground tabular-nums"
                }
              >
                {usedBytes}/{MAX_CONTENT_LENGTH} bytes
              </span>
            </div>
            <Input
              id="task-content"
              placeholder="Implement deleteTask with swap-and-pop"
              autoComplete="off"
              aria-invalid={errors.content ? true : undefined}
              aria-describedby={errors.content ? "task-content-error" : "task-content-hint"}
              disabled={isBusy}
              {...register("content")}
            />
            {errors.content ? (
              <p id="task-content-error" role="alert" className="text-xs text-destructive">
                {errors.content.message}
              </p>
            ) : (
              <p id="task-content-hint" className="text-xs text-muted-foreground">
                The contract counts bytes, not characters: an emoji costs four.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button type="submit" className="w-full" disabled={isBusy || !canSubmit}>
              {isBusy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {submitLabel(isPending || isSubmitting, isConfirming)}
            </Button>

            {mounted && !isConnected ? (
              <p className="text-center text-xs text-muted-foreground">
                Connect your wallet to create tasks.
              </p>
            ) : null}

            {mounted && isConnected && !contractAddress ? (
              <p className="text-center text-xs text-muted-foreground">
                No TodoList address resolved yet — deploy the contract first.
              </p>
            ) : null}

            {isFull ? (
              <p role="alert" className="text-center text-xs text-destructive">
                You are at the on-chain cap of {MAX_TASKS_PER_OWNER} tasks. Delete one to free a
                slot.
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
