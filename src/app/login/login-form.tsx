"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { buttonClass, Field, inputClass } from "@/components/ui/field";

export function LoginForm() {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="username" inputMode="email" required className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-surface px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
