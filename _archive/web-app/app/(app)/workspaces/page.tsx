import { redirect } from "next/navigation";

/** Spaces was removed to keep Synapse focused on decision intelligence. Task/note organizing
 * now lives in the Planner. */
export default function WorkspacesPage() {
  redirect("/planner");
}
