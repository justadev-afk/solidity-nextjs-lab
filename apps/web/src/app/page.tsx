import Link from "next/link";
import { ArrowRight, Coffee, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/lib/env";
import { type Exercise, type ExerciseStatus, exercises } from "@/lib/exercises";
import { cn } from "@/lib/utils";

const techStack = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "wagmi 2",
  "viem 2",
  "RainbowKit",
  "Tailwind CSS v4",
  "Foundry",
  "Anvil",
  "Bun workspaces",
  "Turborepo",
];

const quickStart = [
  {
    command: "cp .env.example .env && cp .env.example apps/web/.env.local",
    hint: "Bun and Forge read the root .env, Next reads apps/web/.env.local.",
  },
  {
    command: "bun run setup",
    hint: "Installs every workspace and the forge-std submodule in packages/contracts/lib.",
  },
  {
    command: "bun run chain",
    hint: "Runs Anvil on port 8545 (chain id 31337). Keep it in its own terminal.",
  },
  {
    command: "packages/contracts/src/02-todo-list/TodoList.sol",
    hint: "Write the current exercise yourself — the interface, brief and tests are already there.",
  },
  {
    command: "bun run contracts:test",
    hint: "Red until you implement the contract, then green. That is the whole exercise.",
  },
  {
    command: "bun run contracts:deploy",
    hint: "Deploys to Anvil and syncs the ABI plus the address into @lab/abi.",
  },
  {
    command: "bun run dev",
    hint: "Opens the frontend on http://localhost:3000.",
  },
];

const statusBadge: Record<ExerciseStatus, { label: string; variant: "default" | "secondary" }> = {
  ready: { label: "Ready", variant: "default" },
  wip: { label: "In progress", variant: "secondary" },
  planned: { label: "Planned", variant: "secondary" },
};

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const isOpen = exercise.status !== "planned";
  const badge = statusBadge[exercise.status];

  return (
    <Card
      data-status={exercise.status}
      aria-disabled={isOpen ? undefined : true}
      className={cn(
        "relative gap-4 transition-all",
        isOpen
          ? "focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-primary/40 hover:shadow-md"
          : "border-dashed opacity-70",
      )}
    >
      <CardHeader>
        <CardAction>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </CardAction>
        <CardTitle className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{exercise.number}</span>
          {exercise.title}
        </CardTitle>
        <CardDescription>{exercise.summary}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap gap-1.5">
        {exercise.concepts.map((concept) => (
          <Badge key={concept} variant="outline" className="font-normal">
            {concept}
          </Badge>
        ))}
      </CardContent>

      <CardFooter className="justify-between gap-3 text-xs text-muted-foreground">
        <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono">
          {exercise.contractPath}
        </code>
        {isOpen ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            Open <ArrowRight className="size-3.5" />
          </span>
        ) : (
          <span>Coming soon</span>
        )}
      </CardFooter>

      {isOpen ? (
        <Link href={exercise.href} className="absolute inset-0 rounded-xl outline-none">
          <span className="sr-only">
            Open exercise {exercise.number}: {exercise.title}
          </span>
        </Link>
      ) : null}
    </Card>
  );
}

export default function HomePage() {
  const featured = exercises.find((exercise) => exercise.status === "ready");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <section className="flex flex-col items-start gap-6">
        <Badge variant="outline" className="gap-1.5">
          <Coffee className="size-3" />
          Solidity from zero, one contract at a time
        </Badge>

        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {env.NEXT_PUBLIC_APP_NAME}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            A monorepo where every exercise ships with an interface, a brief and a full Foundry test
            suite — but not the implementation. You write the contract, run it on a local Anvil
            chain and drive it from a typed Next.js frontend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {featured ? (
            <Button asChild size="lg">
              <Link href={featured.href}>
                Start exercise {featured.number}
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="lg">
            <Link href="/#quick-start">
              <Terminal />
              Quick start
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {techStack.map((item) => (
            <Badge key={item} variant="secondary" className="font-normal">
              {item}
            </Badge>
          ))}
        </div>
      </section>

      <section id="quick-start" className="mt-16 scroll-mt-20">
        <h2 className="text-2xl font-semibold tracking-tight">Quick start</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Node 22 (<code className="font-mono">nvm use</code>), Bun and Foundry are the host
          requirements. Docker is optional and only runs the local chain.
        </p>

        <ol className="mt-6 space-y-3">
          {quickStart.map((step, index) => (
            <li key={step.command} className="flex gap-4">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs text-secondary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 space-y-1">
                <code className="block w-fit max-w-full overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-sm">
                  {step.command}
                </code>
                <p className="text-sm text-muted-foreground">{step.hint}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="exercises" className="mt-16 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Exercises</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Each exercise lives in its own folder, with its own tests and its own page.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {exercises.filter((exercise) => exercise.status === "ready").length} ready ·{" "}
            {exercises.filter((exercise) => exercise.status === "planned").length} planned
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {exercises.map((exercise) => (
            <ExerciseCard key={exercise.slug} exercise={exercise} />
          ))}
        </div>
      </section>
    </div>
  );
}
