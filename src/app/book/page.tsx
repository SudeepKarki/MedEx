import type { Metadata } from "next";
import { ProviderList } from "@/features/booking/components/provider-list";

export const metadata: Metadata = { title: "Book an appointment" };

export default function Page() {
  return <ProviderList />;
}
