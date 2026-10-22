import type { ServiceType } from "./types";

export const SERVICE_TYPE_LABELS: Record<ServiceType, { singular: string; plural: string }> = {
  package: { singular: "Health package", plural: "Health packages" },
  lab_test: { singular: "Lab test", plural: "Lab tests" },
  wellness: { singular: "Wellness", plural: "Wellness treatments" },
  service: { singular: "Medical service", plural: "Medical services" },
  insurance: { singular: "Insurance", plural: "Insurance plans" },
};

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
