import { ArrowRightIcon, GitBranchIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TASKS } from "@/config/tasks";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          Senior Frontend Engineer · take-home
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          MedEx healthcare marketplace exercises
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          One shared Next.js foundation (mock API with latency and failure injection, money
          utilities, accessible app shell) and one branch per exercise.
        </p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {TASKS.map((task, index) => (
          <li
            key={task.id}
            className="relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition-shadow has-[a:hover]:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Task {index + 1}</span>
              {task.href ? (
                <Badge>Ready</Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <GitBranchIcon aria-hidden className="size-3" />
                  Own branch
                </Badge>
              )}
            </div>
            <h2 className="font-heading text-lg leading-snug font-semibold">
              {task.href ? (
                <Link
                  href={task.href}
                  className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                >
                  {task.title}
                </Link>
              ) : (
                task.title
              )}
            </h2>
            <p className="flex-1 text-sm text-muted-foreground italic">{task.story}</p>
            {task.href ? (
              <span
                aria-hidden
                className="flex items-center gap-1 text-sm font-medium text-primary"
              >
                Open
                <ArrowRightIcon className="size-4" />
              </span>
            ) : (
              <code className="text-xs text-muted-foreground">{task.branch}</code>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
