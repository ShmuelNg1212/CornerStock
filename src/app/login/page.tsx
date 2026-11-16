import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/login-screen";
import { NO_ACCESS, NO_ACCESS_MESSAGE } from "@/lib/auth-route";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<{ error?: string | string[] }>;

/** The form with the no-access notice when the app sent the visitor here. */
async function FormWithNotice({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return <LoginForm notice={error === NO_ACCESS ? NO_ACCESS_MESSAGE : null} />;
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  // The shell stays static. Only the form reads the address.
  return (
    <LoginScreen
      form={
        <Suspense fallback={<LoginForm />}>
          <FormWithNotice searchParams={searchParams} />
        </Suspense>
      }
    />
  );
}
