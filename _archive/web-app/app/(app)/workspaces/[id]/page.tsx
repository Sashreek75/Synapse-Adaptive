import { redirect } from "next/navigation";

/** Spaces was removed to keep Synapse focused on decision intelligence. */
export default function WorkspaceDetailPage() {
  redirect("/planner");
}
