import {
  ArrowRightIcon,
  CalendarClockIcon,
  CoinsIcon,
  FlaskConicalIcon,
  GitBranchIcon,
  MapPinIcon,
  PersonStandingIcon,
  SearchIcon,
  ShoppingCartIcon,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TASKS } from "@/config/tasks";
import { cn } from "@/lib/utils";

/** Unsplash photos, always fetched at the one source size next.config allows. */
const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

const TASK_ART: Record<string, { image: string; icon: LucideIcon }> = {
  "task-1": { image: unsplash("photo-1615486511484-92e172cc4fe0"), icon: SearchIcon },
  "task-2": { image: unsplash("photo-1606206591513-adbfbdd7a177"), icon: ShoppingCartIcon },
  "task-3": { image: unsplash("photo-1624969862293-b749659ccc4e"), icon: CalendarClockIcon },
};

const FOUNDATION = [
  { icon: FlaskConicalIcon, label: "Mock API with latency and failure injection" },
  { icon: CoinsIcon, label: "Exact money utilities" },
  { icon: PersonStandingIcon, label: "Accessible app shell" },
];

export default function Home() {
  return (
    <>
      <section className="border-b bg-brand-soft">
        <div className="page-container grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-16">
          <div className="flex flex-col items-start gap-5">
            <p className="rounded-full border border-primary/20 bg-card/80 px-3 py-1 text-xs font-bold tracking-wider text-primary uppercase">
              Senior Frontend Engineer · take-home
            </p>
            <h1 className="font-heading text-4xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl">
              MedEx <span className="gradient-text">healthcare marketplace</span> exercises
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              One shared Next.js foundation (mock API with latency and failure injection, money
              utilities, accessible app shell) and one branch per exercise.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/services" className={buttonVariants({ size: "lg" })}>
                Find services
                <ArrowRightIcon aria-hidden />
              </Link>
              <Link href="/book" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Book an appointment
              </Link>
            </div>
            <ul aria-label="Shared foundation" className="flex flex-wrap gap-2 pt-1">
              {FOUNDATION.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1.5 text-sm font-medium shadow-xs ring-1 ring-border"
                >
                  <Icon aria-hidden className="size-4 text-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Decorative: the copy beside it says what the app is */}
          <div aria-hidden className="relative hidden lg:block">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-brand-gradient opacity-20 blur-2xl" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-card-hover ring-1 ring-black/5">
              <Image
                src={unsplash("photo-1631217868264-e5b90bb7e133")}
                alt=""
                fill
                sizes="(min-width: 1280px) 34rem, 40vw"
                // Above the fold on desktop, where it's the largest paint
                loading="eager"
                fetchPriority="high"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-6 flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-card-hover ring-1 ring-border">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
                <MapPinIcon className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold">Thailand · Nepal · India</span>
                <span className="text-xs text-muted-foreground">Clinics, hospitals and labs</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="exercises-heading" className="page-container py-12 lg:py-16">
        <div className="mb-8 flex flex-col gap-1">
          <h2
            id="exercises-heading"
            className="heading-accent font-heading text-2xl font-bold tracking-tight text-primary"
          >
            The exercises
          </h2>
          <p className="pl-3.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Three branches, one shared foundation
          </p>
        </div>

        <ul className="grid gap-6 md:grid-cols-3">
          {TASKS.map((task, index) => {
            const art = TASK_ART[task.id];
            const Icon = art?.icon ?? GitBranchIcon;
            return (
              <li
                key={task.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-[box-shadow,border-color,translate] duration-200",
                  task.href &&
                    "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover",
                )}
              >
                <div className="relative">
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    {art && (
                      // Decorative: the title says what the card is
                      <Image
                        src={art.image}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 25rem, (min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-black/10" />
                    <span className="absolute top-3 left-3 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-primary shadow-xs">
                      Task {index + 1}
                    </span>
                    <span className="absolute top-3 right-3">
                      {task.href ? (
                        <Badge className="bg-success text-white shadow-xs dark:text-success-muted">
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 bg-card/95">
                          <GitBranchIcon aria-hidden className="size-3" />
                          Own branch
                        </Badge>
                      )}
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className="absolute -bottom-6 left-5 flex size-12 items-center justify-center rounded-full bg-card text-primary shadow-card ring-4 ring-card"
                  >
                    <Icon className="size-5" />
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-5 pt-9">
                  <h3 className="font-heading text-lg leading-snug font-bold">
                    {task.href ? (
                      <Link
                        href={task.href}
                        className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                      >
                        {task.title}
                      </Link>
                    ) : (
                      task.title
                    )}
                  </h3>
                  <p className="flex-1 text-sm text-pretty text-muted-foreground italic">
                    {task.story}
                  </p>
                  <div className="flex items-center justify-between gap-3 border-t pt-4">
                    <code className="truncate text-xs text-muted-foreground">{task.branch}</code>
                    {task.href && (
                      <span
                        aria-hidden
                        className="flex shrink-0 items-center gap-1 rounded-lg border-2 border-primary/35 px-3 py-1.5 text-xs font-bold text-primary transition-colors group-hover:border-primary group-hover:bg-accent"
                      >
                        Open
                        <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
