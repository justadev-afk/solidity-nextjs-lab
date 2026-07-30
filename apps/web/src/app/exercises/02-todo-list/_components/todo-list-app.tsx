"use client";

import { Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DeployHint } from "@/components/web3/deploy-hint";
import { NetworkGuard } from "@/components/web3/network-guard";
import { useListOwner, useTodoListAddress, useTodoListUnavailable } from "@/hooks/use-todo-list";
import { useMounted } from "@/hooks/use-mounted";

import { ListStats } from "./list-stats";
import { NewTaskForm } from "./new-task-form";
import { TaskBoard } from "./task-board";

const DEPLOY_HINT = {
  contractName: "TodoList",
  interfaceName: "ITodoList",
  contractPath: "packages/contracts/src/02-todo-list/TodoList.sol",
  deployScript: "contracts:deploy:02",
  addressEnvVar: "NEXT_PUBLIC_TODO_LIST_ADDRESS",
} as const;

export function TodoListApp() {
  const mounted = useMounted();
  const { address } = useTodoListAddress();
  const owner = useListOwner();
  const readsUnavailable = useTodoListUnavailable();

  return (
    <div className="space-y-6">
      <NetworkGuard />

      {!address ? <DeployHint reason="no-address" {...DEPLOY_HINT} /> : null}
      {readsUnavailable ? <DeployHint reason="read-failed" {...DEPLOY_HINT} /> : null}

      {mounted && owner === undefined ? (
        <Alert>
          <Wallet className="size-4" aria-hidden="true" />
          <AlertTitle>Connect a wallet to see your list</AlertTitle>
          <AlertDescription>
            There is no owner and no admin in this contract: your tasks are keyed by the address you
            connect with. Switching accounts in the wallet switches lists — that is the whole point
            of the exercise, so import at least two Anvil accounts and try it.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <NewTaskForm />
        <ListStats />
        <div className="lg:col-span-2">
          <TaskBoard />
        </div>
      </div>
    </div>
  );
}
