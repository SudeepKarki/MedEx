const GROUP_TITLES: Record<string, string> = {
  lab_test: "Lab tests",
  package: "Health packages",
  wellness: "Wellness",
  service: "Medical services",
  insurance: "Insurance",
  unknown: "No longer available",
};

export function groupTitle(type: string): string {
  return GROUP_TITLES[type] ?? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function durationLabel(minutes: number): string {
  return `${minutes} min`;
}

export function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
