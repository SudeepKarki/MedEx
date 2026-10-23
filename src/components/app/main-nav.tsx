"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

export interface NavLink {
  href: string;
  label: string;
}

type Tone = "on-brand" | "on-surface";

const linkClass: Record<Tone, string> = {
  // On the header gradient: white text, a translucent white pill for hover and the current page
  "on-brand":
    "text-[0.8125rem] font-semibold tracking-wide text-white/90 uppercase hover:bg-white/15 hover:text-white focus-visible:ring-white/70 aria-[current=page]:bg-white/20 aria-[current=page]:text-white",
  // On the phone's lavender row
  "on-surface":
    "font-medium text-accent-foreground hover:bg-card/70 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:text-primary aria-[current=page]:shadow-xs",
};

function NavLinkList({
  links,
  tone,
  pathname,
}: {
  links: NavLink[];
  tone: Tone;
  pathname: string | null;
}) {
  return links.map((link) => {
    const current =
      pathname !== null && (pathname === link.href || pathname.startsWith(`${link.href}/`));
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "shrink-0 rounded-full px-3.5 py-2 transition-colors outline-none focus-visible:ring-3",
          linkClass[tone],
        )}
      >
        {link.label}
      </Link>
    );
  });
}

function CurrentNavLinkList(props: { links: NavLink[]; tone: Tone }) {
  return <NavLinkList {...props} pathname={usePathname()} />;
}

/**
 * The header's links, with the current section marked. `usePathname` suspends while
 * prerendering routes with unknown params (/book/[providerId]), so the static shell
 * renders the same links without the mark and it appears on hydration.
 */
export function MainNavLinks(props: { links: NavLink[]; tone: Tone }) {
  return (
    <Suspense fallback={<NavLinkList {...props} pathname={null} />}>
      <CurrentNavLinkList {...props} />
    </Suspense>
  );
}
