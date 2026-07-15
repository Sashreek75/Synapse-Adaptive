import { redirect } from "next/navigation";

/** The conversation IS the homepage now — folded into Home (founding-doc pivot). */
export default function AgentPage() {
  redirect("/dashboard#conversation");
}
