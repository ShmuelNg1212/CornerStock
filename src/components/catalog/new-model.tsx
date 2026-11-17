"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCatalogModel } from "@/app/(app)/catalog/actions";
import { MODEL_FIELDS } from "@/app/(app)/scan/scan-types";
import { buttonClass, Field, inputClass } from "@/components/ui/field";

export function NewModel() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();
  const fields = [
    ...MODEL_FIELDS,
    {
      field: "selling_price",
      label: "Selling price (₱)",
      mode: "decimal" as const,
      mono: false,
    },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/catalog" className={buttonClass.link}>
        ← Catalog
      </Link>
      <h1 className="font-heading mt-4 text-2xl font-bold">Add model</h1>
      <p className="mt-2 text-muted-foreground">
        Prepare a model before receiving stock. UPC, model name, and weight are
        required.
      </p>
      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          startTransition(async () => {
            try {
              const result = await createCatalogModel(values, requestId);
              if (result.ok) {
                toast.success("Model added to catalog");
                router.push("/catalog");
              } else {
                setError(result.error);
                setFieldErrors(result.fieldErrors ?? {});
              }
            } catch {
              setError("The model could not be saved. Try again.");
            }
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((spec) => (
            <Field
              key={spec.field}
              label={spec.label}
              error={fieldErrors[spec.field]}
            >
              <input
                className={`${inputClass} ${spec.mono ? "font-mono" : ""}`}
                inputMode={spec.mode}
                value={values[spec.field] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [spec.field]: event.target.value,
                  }))
                }
                disabled={pending}
                required={["upc", "model_name", "nominal_weight_lb"].includes(
                  spec.field,
                )}
                aria-invalid={!!fieldErrors[spec.field]}
              />
            </Field>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-destructive">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button disabled={pending} className={buttonClass.action}>
            {pending ? "Saving…" : "Add model"}
          </button>
          <Link href="/catalog" className={buttonClass.quiet}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
