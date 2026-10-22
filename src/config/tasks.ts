/**
 * The three take-home exercises. Each lives on its own branch on top of this
 * shared base; a task's `href` is set on the branch that implements it.
 */
export interface TaskEntry {
  id: string;
  title: string;
  story: string;
  branch: string;
  href: string | null;
}

export const TASKS: TaskEntry[] = [
  {
    id: "task-1",
    title: "Service Explorer with live faceted filters",
    story:
      "“I need a full-body check-up near Bangkok, under 5,000 THB, and I'd like to compare a few hospitals side by side before I commit.”",
    branch: "task-1-service-explorer",
    href: "/services",
  },
  {
    id: "task-2",
    title: "Multi-provider cart and split checkout",
    story:
      "“I put a lab test from one clinic, a facial from a spa, and a check-up package from a hospital in my cart. Then I tried to pay.”",
    branch: "task-2-cart-checkout",
    href: null,
  },
  {
    id: "task-3",
    title: "Appointment booking across time zones",
    story:
      "“I live in Kathmandu. I'm booking a check-up at a hospital in Bangkok for when I travel there next month. Which time is the appointment, mine or theirs?”",
    branch: "task-3-booking-time-zones",
    href: null,
  },
];
