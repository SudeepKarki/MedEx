export function SkipLink({ href = "#main", children = "Skip to content" }) {
  return (
    <a
      href={href}
      className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      {children}
    </a>
  );
}
