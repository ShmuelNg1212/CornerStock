import { LogoMark } from "@/components/logo";

/** The sign-in screen. Large screens show the brand at the left and the form at the right. */
export function LoginScreen({ form }: { form: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="bg-rail px-6 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-9 text-rail-foreground lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div>
          <LogoMark className="size-14 lg:size-16" onDark />
          <p className="font-heading mt-5 text-3xl font-bold tracking-tight lg:text-4xl">CORNERSTOCK</p>
          <p className="mt-1.5 flex items-center gap-3 text-rail-muted">
            <span className="h-px w-6 bg-gold" aria-hidden="true" />
            For Bowlers Corner
          </p>
        </div>
        <p className="font-heading mt-8 max-w-sm text-2xl leading-tight font-semibold text-balance lg:mt-0 lg:text-4xl">
          Every item.
          <br />
          Accounted for.
        </p>
      </div>
      <main className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-9 lg:mx-0 lg:max-w-md lg:px-14">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 mb-6 text-muted-foreground">Use the account that the owner made for you.</p>
        {form}
        <p className="mt-6 text-sm text-muted-foreground">No account? Ask the owner to make one for you.</p>
      </main>
    </div>
  );
}
