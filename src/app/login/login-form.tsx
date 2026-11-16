"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

export function LoginForm({ notice = null }: { notice?: string | null }) {
  // The notice shows until the first sign-in attempt replaces it.
  const [error, action, pending] = useActionState(signIn, notice);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="username" inputMode="email" required className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
