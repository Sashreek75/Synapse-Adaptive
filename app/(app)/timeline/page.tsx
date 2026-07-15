import { redirect } from "next/navigation";

/** Folded into the Health Profile (founding-doc pivot): the profile narrates
 * how Synapse's understanding evolved, which is what the timeline was for. */
export default function TimelinePage() {
  redirect("/profile");
}
