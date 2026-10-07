import type { Metadata } from "next";

import { LoginForm } from "@/components/common/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <LoginForm />;
}
