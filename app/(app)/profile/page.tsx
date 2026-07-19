import { redirect } from "next/navigation";

/** Consolidated in the v2 pivot: the separate health profile is gone. Everything
 * Synapse understands about you — who you're becoming, your patterns, your
 * progress — now lives in one place: You. */
export default function ProfilePage() {
  redirect("/playbook");
}
