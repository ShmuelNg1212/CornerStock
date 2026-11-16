import type { Metadata } from "next";
import { LoginScreen } from "@/components/login-screen";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <LoginScreen form={<LoginForm />} />;
}
