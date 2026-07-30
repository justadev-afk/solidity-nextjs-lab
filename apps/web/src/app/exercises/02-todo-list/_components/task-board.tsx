"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Circle,
  CircleCheck,
  ListTodo,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TxStatus } from "@/components/web3/tx-status";
import { useMounted } from "@/hooks/use-mounted";
import {
  filterTasks,
  MAX_CONTENT_LENGTH,
  useListOwner,
  useTasks,
  useTodoListAddress,
  useTodoListWrite,
  type Task,
  type TaskFilter,
} from "@/hooks/use-todo-list";
import { describeTxError } from "@/lib/errors";
import { byteLength, formatRelativeTime, formatTimestamp } from "@/lib/format";

const SKELETON_ROWS = [0, 1, 2];

const FILTERS: readonly { id: TaskFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

type TaskRowProps = {
  task: Task;
  isBusy: boolean;
  isEditing: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
};

function TaskRow({
  task,
  isBusy,
  isEditing,
  draft,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggle,
  onDelete,
}: TaskRowProps) {
  const draftBytes = byteLength(draft.trim());
  const draftIsValid = draftBytes > 0 && draftBytes <= MAX_CONTENT_LENGTH;

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        disabled={isBusy || isEditing}
        onClick={onToggle}
        aria-pressed={task.completed}
        aria-label={
          task.completed
            ? `Mark task ${task.id.toString()} as pending`
            : `Mark task ${task.id.toString()} as done`
        }
      >
        {task.completed ? (
          <CircleCheck className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <Circle className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </Button>

      <div className="min-w-0 flex-1 space-y-1">
        {isEditing ? (
          <div className="space-y-1.5">
            <Input
              value={draft}
              autoFocus
              aria-label={`Edit task ${task.id.toString()}`}
              disabled={isBusy}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && draftIsValid) onSaveEdit();
                if (event.key === "Escape") onCancelEdit();
              }}
            />
            <p
              className={
                draftBytes > MAX_CONTENT_LENGTH
                  ? "text-xs text-destructive tabular-nums"
                  : "text-xs text-muted-foreground tabular-nums"
              }
            >
              {draftBytes}/{MAX_CONTENT_LENGTH} bytes · Enter to save, Esc to cancel
            </p>
          </div>
        ) : (
          <p
            className={
              task.completed
                ? "text-sm break-words text-muted-foreground line-through"
                : "text-sm break-words"
            }
          >
            {task.content}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-mono font-normal">
            #{task.id.toString()}
          </Badge>
          <span title={formatTimestamp(task.createdAt)}>
            created {formatRelativeTime(task.createdAt)}
          </span>
          {task.updatedAt !== task.createdAt ? (
            <span title={formatTimestamp(task.updatedAt)}>
              · edited {formatRelativeTime(task.updatedAt)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isEditing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={isBusy || !draftIsValid}
              onClick={onSaveEdit}
              aria-label={`Save task ${task.id.toString()}`}
            >
              <Check className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={isBusy}
              onClick={onCancelEdit}
              aria-label="Cancel editing"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={isBusy}
              onClick={onStartEdit}
              aria-label={`Edit task ${task.id.toString()}`}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              disabled={isBusy}
              onClick={onDelete}
              aria-label={`Delete task ${task.id.toString()}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function TaskBoard() {
  const mounted = useMounted();
  const { address, chainId } = useTodoListAddress();
  const owner = useListOwner();
  const { tasks, isLoading, refetch } = useTasks(owner);
  const {
    updateTask,
    toggleTask,
    deleteTask,
    clearCompleted,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  } = useTodoListWrite();

  const [filter, setFilter] = useState<TaskFilter>("all");
  const [editingId, setEditingId] = useState<bigint | undefined>(undefined);
  const [draft, setDraft] = useState("");

  const isBusy = isPending || isConfirming;
  const visible = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);
  const completed = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const showSkeleton = isLoading && Boolean(address) && owner !== undefined;

  const counts: Record<TaskFilter, number> = {
    all: tasks.length,
    active: tasks.length - completed,
    completed,
  };

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (cause) {
      toast.error(describeTxError(cause));
    }
  };

  const onSaveEdit = (task: Task) => {
    const content = draft.trim();
    if (content === task.content) {
      setEditingId(undefined);
      return;
    }
    setEditingId(undefined);
    void run(() => updateTask(task.id, content));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardDescription>
          Sorted by id (creation order). On chain the array order changes whenever{" "}
          <code className="font-mono">deleteTask</code> swaps the last task into the freed slot —
          the UI sorts, the contract does not.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => refetch()}
            aria-label="Refresh the task list"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tasks">
            {FILTERS.map((entry) => (
              <Button
                key={entry.id}
                type="button"
                size="sm"
                variant={filter === entry.id ? "default" : "outline"}
                aria-pressed={filter === entry.id}
                onClick={() => setFilter(entry.id)}
              >
                {entry.label}
                <span className="tabular-nums opacity-70">{counts[entry.id]}</span>
              </Button>
            ))}
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isBusy || completed === 0}
            onClick={() => void run(() => clearCompleted())}
          >
            {isBusy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            Clear completed
          </Button>
        </div>

        {showSkeleton ? (
          <ul className="divide-y divide-border">
            {SKELETON_ROWS.map((row) => (
              <li key={row} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full max-w-sm" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </li>
            ))}
          </ul>
        ) : !mounted || owner === undefined ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ListTodo className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No wallet connected</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Tasks are keyed by address, so there is nothing to show until you connect.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ListTodo className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">
              {tasks.length === 0
                ? "Your list is empty — add the first task"
                : "Nothing matches this filter"}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Every task costs a transaction: creating, editing, checking and deleting all write to
              storage.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((task) => (
              <TaskRow
                key={task.id.toString()}
                task={task}
                isBusy={isBusy}
                isEditing={editingId === task.id}
                draft={draft}
                onDraftChange={setDraft}
                onStartEdit={() => {
                  setEditingId(task.id);
                  setDraft(task.content);
                }}
                onCancelEdit={() => setEditingId(undefined)}
                onSaveEdit={() => onSaveEdit(task)}
                onToggle={() => void run(() => toggleTask(task.id))}
                onDelete={() => void run(() => deleteTask(task.id))}
              />
            ))}
          </ul>
        )}

        <TxStatus
          hash={hash}
          isPending={isPending}
          isConfirming={isConfirming}
          isConfirmed={isConfirmed}
          error={error}
          chainId={chainId}
        />
      </CardContent>
    </Card>
  );
}
