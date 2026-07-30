"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";

import { getDeployment, todoListAbi } from "@lab/abi";
import { localChain, supportedChains } from "@/lib/chains";
import { env } from "@/lib/env";
import { describeTxError } from "@/lib/errors";

/** Mirrors `ITodoList.Task`. `uint64` timestamps come back from viem as `bigint`. */
export type Task = {
  id: bigint;
  content: string;
  completed: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

export type TaskFilter = "all" | "active" | "completed";

export type ListStats = {
  taskCount: bigint | undefined;
  completedCount: bigint | undefined;
  nextTaskId: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export type TasksResult = {
  tasks: readonly Task[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export type TodoListWrite = {
  createTask: (content: string) => Promise<void>;
  updateTask: (id: bigint, content: string) => Promise<void>;
  toggleTask: (id: bigint) => Promise<void>;
  deleteTask: (id: bigint) => Promise<void>;
  clearCompleted: () => Promise<void>;
  hash: `0x${string}` | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: unknown;
  reset: () => void;
};

/** Contract-side limits. Not on the interface (see `ITodoList`), so the UI mirrors them. */
export const MAX_CONTENT_LENGTH = 160;
export const MAX_TASKS_PER_OWNER = 50;

/** Placeholder passed to owner-scoped reads while no wallet is connected (they stay disabled). */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * Chain ids the wagmi config actually knows how to talk to. wagmi types every `chainId`
 * option as the union of the configured chain ids, so a plain `number` is not accepted.
 */
type TargetChainId = (typeof supportedChains)[number]["id"];

/** Shape of one `useReadContracts` entry, kept loose so narrowing stays explicit. */
type ReadEntry = { status: string; result?: unknown };

/** `useReadContracts` returns `[{ result, status }, ...]`; validate before reading it. */
function toReadEntries(data: unknown): readonly ReadEntry[] {
  if (!Array.isArray(data)) return [];
  return data.map((entry: unknown) =>
    typeof entry === "object" && entry !== null ? (entry as ReadEntry) : { status: "failure" },
  );
}

function asBigInt(entry: ReadEntry | undefined): bigint | undefined {
  if (entry?.status !== "success") return undefined;
  const value: unknown = entry.result;
  return typeof value === "bigint" ? value : undefined;
}

function parseTask(value: unknown): Task | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<Record<keyof Task, unknown>>;
  const { id, content, completed, createdAt, updatedAt } = candidate;
  if (typeof id !== "bigint" || typeof createdAt !== "bigint" || typeof updatedAt !== "bigint") {
    return undefined;
  }
  if (typeof content !== "string" || typeof completed !== "boolean") return undefined;
  return { id, content, completed, createdAt, updatedAt };
}

/**
 * Keeps a referentially stable callback so `useWatchContractEvent` does not
 * tear down and recreate its event filter on every render.
 */
function useStableHandler(handler: () => void): () => void {
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  return useCallback(() => {
    ref.current();
  }, []);
}

/** Falls back to the local chain whenever the wallet sits on a chain we do not configure. */
function toTargetChainId(id: number): TargetChainId {
  return supportedChains.find((chain) => chain.id === id)?.id ?? localChain.id;
}

function useTodoListTarget(): { address: `0x${string}` | undefined; chainId: TargetChainId } {
  const walletChainId = useChainId();
  const chainId = toTargetChainId(walletChainId);
  const address = env.NEXT_PUBLIC_TODO_LIST_ADDRESS ?? getDeployment("TodoList", chainId);

  return { address, chainId };
}

export function useTodoListAddress(): {
  address: `0x${string}` | undefined;
  chainId: number;
} {
  return useTodoListTarget();
}

/**
 * The list the page is looking at: the connected wallet. Reads take an explicit owner in the
 * contract, so this is the single place that decides whose list is on screen.
 */
export function useListOwner(): `0x${string}` | undefined {
  const { address } = useAccount();
  return address;
}

/**
 * Refetches `handler` whenever the contract emits one of the five list events for `owner`.
 * `owner` is an indexed topic, so the node filters the logs for us.
 *
 * The five calls are written out one by one on purpose: a loop over `WATCHED_EVENTS` would call
 * hooks inside a loop, which is exactly what the rules of hooks forbid.
 */
function useListEvents(owner: `0x${string}` | undefined, handler: () => void): void {
  const { address, chainId } = useTodoListTarget();
  const enabled = Boolean(address) && owner !== undefined;
  const onLogs = useStableHandler(handler);
  const args = owner === undefined ? undefined : { owner };

  useWatchContractEvent({
    address,
    abi: todoListAbi,
    chainId,
    eventName: "TaskCreated",
    args,
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: todoListAbi,
    chainId,
    eventName: "TaskUpdated",
    args,
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: todoListAbi,
    chainId,
    eventName: "TaskToggled",
    args,
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: todoListAbi,
    chainId,
    eventName: "TaskDeleted",
    args,
    enabled,
    onLogs,
  });
  useWatchContractEvent({
    address,
    abi: todoListAbi,
    chainId,
    eventName: "CompletedCleared",
    args,
    enabled,
    onLogs,
  });
}

export function useListStats(owner: `0x${string}` | undefined): ListStats {
  const { address, chainId } = useTodoListTarget();
  const enabled = Boolean(address) && owner !== undefined;
  const account = owner ?? ZERO_ADDRESS;

  const reads = useReadContracts({
    contracts: [
      { address, abi: todoListAbi, functionName: "taskCount", args: [account], chainId },
      { address, abi: todoListAbi, functionName: "completedCount", args: [account], chainId },
      { address, abi: todoListAbi, functionName: "nextTaskId", args: [account], chainId },
    ],
    query: { enabled },
  });

  const refetchReads = reads.refetch;
  const refetch = useCallback(() => {
    void refetchReads();
  }, [refetchReads]);

  useListEvents(owner, refetch);

  const entries = toReadEntries(reads.data);
  const hasFailedRead = entries.length > 0 && entries.some((entry) => entry.status !== "success");

  return {
    taskCount: asBigInt(entries[0]),
    completedCount: asBigInt(entries[1]),
    nextTaskId: asBigInt(entries[2]),
    isLoading: reads.isLoading,
    isError: reads.isError || hasFailedRead,
    refetch,
  };
}

export function useTasks(owner: `0x${string}` | undefined): TasksResult {
  const { address, chainId } = useTodoListTarget();
  const enabled = Boolean(address) && owner !== undefined;
  const account = owner ?? ZERO_ADDRESS;

  const read = useReadContract({
    address,
    abi: todoListAbi,
    functionName: "getTasks",
    args: [account],
    chainId,
    query: { enabled },
  });

  const refetchTasks = read.refetch;
  const refetch = useCallback(() => {
    void refetchTasks();
  }, [refetchTasks]);

  useListEvents(owner, refetch);

  // The contract returns storage order, which `deleteTask` shuffles on purpose (swap-and-pop).
  // Sorting by id here gives the UI a stable creation order without costing any gas.
  const tasks = useMemo<readonly Task[]>(() => {
    const raw = read.data;
    if (!Array.isArray(raw)) return [];
    const parsed: Task[] = [];
    for (const entry of raw) {
      const task = parseTask(entry);
      if (task !== undefined) parsed.push(task);
    }
    return parsed.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  }, [read.data]);

  return { tasks, isLoading: read.isLoading, isError: read.isError, refetch };
}

export function useTodoListWrite(): TodoListWrite {
  const { address, chainId } = useTodoListTarget();
  const {
    data: hash,
    error: writeError,
    isPending,
    reset,
    writeContractAsync,
  } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId });

  const createTask = useCallback(
    async (content: string): Promise<void> => {
      if (!address) {
        toast.error("No TodoList address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: todoListAbi,
          chainId,
          functionName: "createTask",
          args: [content],
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const updateTask = useCallback(
    async (id: bigint, content: string): Promise<void> => {
      if (!address) {
        toast.error("No TodoList address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: todoListAbi,
          chainId,
          functionName: "updateTask",
          args: [id, content],
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const toggleTask = useCallback(
    async (id: bigint): Promise<void> => {
      if (!address) {
        toast.error("No TodoList address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: todoListAbi,
          chainId,
          functionName: "toggleTask",
          args: [id],
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const deleteTask = useCallback(
    async (id: bigint): Promise<void> => {
      if (!address) {
        toast.error("No TodoList address for this network — deploy it first.");
        return;
      }

      try {
        await writeContractAsync({
          address,
          abi: todoListAbi,
          chainId,
          functionName: "deleteTask",
          args: [id],
        });
      } catch (cause) {
        toast.error(describeTxError(cause));
      }
    },
    [address, chainId, writeContractAsync],
  );

  const clearCompleted = useCallback(async (): Promise<void> => {
    if (!address) {
      toast.error("No TodoList address for this network — deploy it first.");
      return;
    }

    try {
      await writeContractAsync({
        address,
        abi: todoListAbi,
        chainId,
        functionName: "clearCompleted",
      });
    } catch (cause) {
      toast.error(describeTxError(cause));
    }
  }, [address, chainId, writeContractAsync]);

  const error: unknown = writeError ?? receipt.error ?? undefined;

  return {
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
    clearCompleted,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isConfirmed: receipt.isSuccess,
    error,
    reset,
  };
}

export function filterTasks(tasks: readonly Task[], filter: TaskFilter): readonly Task[] {
  if (filter === "active") return tasks.filter((task) => !task.completed);
  if (filter === "completed") return tasks.filter((task) => task.completed);
  return tasks;
}

/** Guard used by the "no contract here" banner: an address that never answers a read. */
export function useTodoListUnavailable(): boolean {
  const { address, chainId } = useTodoListTarget();

  const read = useReadContract({
    address,
    abi: todoListAbi,
    functionName: "taskCount",
    args: [ZERO_ADDRESS],
    chainId,
    query: { enabled: Boolean(address) },
  });

  return Boolean(address) && !read.isLoading && read.data === undefined;
}
