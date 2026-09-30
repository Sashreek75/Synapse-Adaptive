import { redirect } from "next/navigation";

/** Retired in the v2 pivot: provider prep is no longer a product surface. The
 * conversation handles "worth raising with a provider" when it matters. */
export default function AppointmentPrepPage() {
  redirect("/dashboard");
}
