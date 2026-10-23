"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle dark mode"
      // Lives on the header gradient
      className="rounded-full text-white hover:bg-white/15 hover:text-white focus-visible:border-white/70 focus-visible:ring-white/50 dark:hover:bg-white/15"
    >
      {/* Both icons rendered and swapped with CSS so server and client markup match */}
      <SunIcon aria-hidden className="hidden dark:block" />
      <MoonIcon aria-hidden className="dark:hidden" />
    </Button>
  );
}
