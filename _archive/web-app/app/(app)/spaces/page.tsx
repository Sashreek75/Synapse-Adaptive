import { redirect } from "next/navigation";

/** Removed in the founding-doc pivot: it didn't help anyone make a better
 * health decision. Accumulated understanding lives in the Playbook now. */
export default function SpacesPage() {
  redirect("/playbook");
}
