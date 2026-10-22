"use client";

import { type LottieHandle, LottieSvg } from "lottie-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import animation from "./medex-logo-animation.json";

/**
 * The animated wordmark, looping as it does on medex.co. Imported rather than fetched
 * from `public/` so it ships in the header's hashed chunk and draws as soon as the header
 * hydrates. `LottieSvg` keeps the expression engine (the file uses expressions) without
 * the canvas and html renderers.
 *
 * Started from `ready` rather than `autoplay`: lottie-react 3 skips autoplay when the
 * device asks for reduced motion, and medex.co plays it regardless. Endless motion with
 * no pause control is a deliberate trade-off against WCAG 2.2.2.
 *
 * Sized on a wrapper: lottie-react injects `width/height: 100%` in a cascade layer
 * declared after Tailwind's, which outranks utilities put on the animation itself.
 */
export function MedExLogo({ className }: { className?: string }) {
  const lottie = useRef<LottieHandle>(null);

  return (
    <div aria-hidden className={cn("aspect-[117/40] h-12 md:h-16", className)}>
      <LottieSvg
        src={animation}
        lottieRef={lottie}
        loop
        subscriptions={{ ready: () => lottie.current?.play() }}
      />
    </div>
  );
}
