import type { Metadata } from "next";
import { LoginForm } from "./login-form";

// Server component so /login gets its own title/description (the interactive form is a client child).
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Synapse Adaptive — your AI partner in follow-through.",
  robots: { index: false, follow: false }, // auth page: don't index it
};

export default function LoginPage() {
  return <LoginForm />;
}
