import { CheckoutRunner } from "@/features/cart/components/checkout-runner";

export default function CartLayout({ children }: LayoutProps<"/cart">) {
  return (
    <>
      {children}
      <CheckoutRunner />
    </>
  );
}
