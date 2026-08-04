import { redirect } from "next/navigation";

/** Retired in the consolidation pass: standalone assessments are a health-era surface and
 * off-philosophy for a partner in follow-through. What Synapse needs to understand it learns
 * by talking and by watching follow-through — not by making people fill out forms. The
 * conversation is the front door. */
export default function AssessmentsPage() {
  redirect("/dashboard");
}
