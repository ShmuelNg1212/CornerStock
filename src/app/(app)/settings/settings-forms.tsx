"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addLocation, addStaff, updateLocation, updateStaff, type ActionResult } from "@/app/actions";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { Location, Profile } from "@/lib/types";

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, onDone?: () => void) =>
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action();
      } catch {
        result = { ok: false, error: "The change was not sent. Check the connection and try again." };
      }
      setError(result.ok ? null : result.error);
      if (result.ok) onDone?.();
    });
  return { error, pending, run };
}

const ErrorLine = ({ error }: { error: string | null }) => (error ? <Notice tone="error">{error}</Notice> : null);

const smallButton = buttonClass.small;

function LocationRow({ location, count }: { location: Location; count: number }) {
  const { error, pending, run } = useAction();
  const [name, setName] = useState<string | null>(null);
  return (
    <li className="space-y-2 px-4 py-3">
      {name === null ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-40 flex-1">
            <p className="font-semibold break-words">{location.name}</p>
            <p className="tabular text-sm text-muted-foreground">
              {location.active ? `${count} ${count === 1 ? "ball" : "balls"} in stock` : "Closed. Not in the location selector."}
            </p>
          </div>
          <button type="button" className={smallButton} disabled={pending} onClick={() => setName(location.name)}>
            Rename
          </button>
          <button
            type="button"
            className={smallButton}
            disabled={pending}
            onClick={() => run(() => updateLocation(location.id, { active: !location.active }), () => toast.success(location.active ? "Location closed" : "Location opened"))}
          >
            {location.active ? "Close" : "Open"}
          </button>
        </div>
      ) : (
        <form
          className="flex animate-enter flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => updateLocation(location.id, { name }), () => {
              setName(null);
              toast.success("Location renamed");
            });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Location name" maxLength={80} required autoFocus className={`${inputClass} min-w-40 flex-1`} />
          <button type="submit" disabled={pending} className={buttonClass.primary}>
            Save
          </button>
          <button type="button" onClick={() => setName(null)} className={buttonClass.quiet}>
            Cancel
          </button>
        </form>
      )}
      <ErrorLine error={error} />
    </li>
  );
}

export function LocationSettings({ locations, inStock }: { locations: Location[]; inStock: Record<string, number> }) {
  const { error, pending, run } = useAction();
  const [name, setName] = useState("");
  return (
    <section className="mt-6" aria-labelledby="locations-heading">
      <h2 id="locations-heading" className="text-lg font-semibold">
        Locations
      </h2>
      <p className="text-muted-foreground">Each location has its own stock.</p>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
        {locations.map((location) => (
          <LocationRow key={location.id} location={location} count={inStock[location.id] ?? 0} />
        ))}
      </ul>
      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => addLocation(name), () => {
            toast.success(`Location added · ${name.trim()}`);
            setName("");
          });
        }}
      >
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New location name"
            aria-label="New location name"
            maxLength={80}
            required
            className={inputClass}
          />
          <button type="submit" disabled={pending} className={`${buttonClass.primary} shrink-0`}>
            Add location
          </button>
        </div>
        <ErrorLine error={error} />
      </form>
    </section>
  );
}

function StaffRow({ person, own }: { person: Profile; own: boolean }) {
  const { error, pending, run } = useAction();
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-40 flex-1">
          <p className="font-semibold break-words">
            {person.full_name || "No name"}
            {own && <span className="font-normal text-muted-foreground"> (you)</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {person.role === "owner" ? "Owner" : "Staff"}
            {!person.active && " · Access removed"}
          </p>
        </div>
        {!own && (
          <>
            <button
              type="button"
              className={smallButton}
              disabled={pending}
              onClick={() => run(() => updateStaff(person.id, { role: person.role === "owner" ? "staff" : "owner" }))}
            >
              {person.role === "owner" ? "Make staff" : "Make owner"}
            </button>
            <button
              type="button"
              className={smallButton}
              disabled={pending}
              onClick={() => run(() => updateStaff(person.id, { active: !person.active }))}
            >
              {person.active ? "Remove access" : "Give access"}
            </button>
          </>
        )}
      </div>
      <ErrorLine error={error} />
    </li>
  );
}

export function StaffSettings({ staff, ownId }: { staff: Profile[]; ownId: string }) {
  const { error, pending, run } = useAction();
  const empty = { fullName: "", email: "", password: "" };
  const [form, setForm] = useState(empty);
  const [added, setAdded] = useState<string | null>(null);
  return (
    <section className="mt-10" aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="text-lg font-semibold">
        Staff accounts
      </h2>
      <p className="text-muted-foreground">Staff add balls, mark them as sold, and move them. Owners also correct records and manage accounts.</p>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
        {staff.map((person) => (
          <StaffRow key={person.id} person={person} own={person.id === ownId} />
        ))}
      </ul>
      <form
        className="mt-3 space-y-3.5 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setAdded(null);
          run(() => addStaff(form), () => {
            setAdded(form.email);
            setForm(empty);
          });
        }}
      >
        <p className="font-semibold">Add a staff account</p>
        <Field label="Name">
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={80} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="off" inputMode="email" className={inputClass} />
        </Field>
        <Field label="First password" hint="8 characters or more. Give it to the staff member in person.">
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} maxLength={72} autoComplete="new-password" className={`${inputClass} font-mono`} />
        </Field>
        <ErrorLine error={error} />
        {added && <Notice tone="ok">Account made for {added}.</Notice>}
        <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
          {pending ? "Adding…" : "Add account"}
        </button>
      </form>
    </section>
  );
}
