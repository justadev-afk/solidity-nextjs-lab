import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, FileCode, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { exercises } from "@/lib/exercises";

import { CrowdfundApp } from "./_components/crowdfund-app";

const SLUG = "03-crowdfund";

const exercise = exercises.find((item) => item.slug === SLUG);

const exerciseNumber = exercise?.number ?? "03";
const title = exercise?.title ?? "Crowdfund";
const summary =
  exercise?.summary ??
  "Anyone opens time-boxed campaigns with an ETH goal: backers are refunded in full when one fails, and the creator is paid minus a 2% protocol fee when it succeeds.";
const contractPath = exercise?.contractPath ?? `packages/contracts/src/${SLUG}`;
const concepts = exercise?.concepts ?? [];

export const metadata: Metadata = {
  title: `${exerciseNumber} · ${title}`,
  description: summary,
};

export default function CrowdfundPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the lab
        </Link>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              Exercise {exerciseNumber}
            </Badge>
            {exercise?.status === "ready" ? <Badge variant="outline">Ready to build</Badge> : null}
          </div>

          <h1 className="flex items-start gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            <Target className="mt-1 size-7 shrink-0 text-primary" aria-hidden="true" />
            <span>{title}</span>
          </h1>

          <p className="max-w-2xl leading-relaxed text-muted-foreground">{summary}</p>

          {concepts.length > 0 ? (
            <ul aria-label="Concepts covered" className="flex flex-wrap gap-2">
              {concepts.map((concept) => (
                <li key={concept}>
                  <Badge variant="outline" className="font-normal">
                    {concept}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
            <FileCode className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Contract you implement</p>
              <code className="block font-mono text-xs break-all text-muted-foreground">
                {contractPath}/Crowdfund.sol
              </code>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Exercise brief</p>
              <code className="block font-mono text-xs break-all text-muted-foreground">
                {contractPath}/README.md
              </code>
            </div>
          </div>
        </div>
      </header>

      <Separator />

      <CrowdfundApp />
    </div>
  );
}
