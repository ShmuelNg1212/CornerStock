function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. See doc/wiki/setup.md.`);
  return value;
}

// NEXT_PUBLIC values are in the browser bundle. They are safe to show: row-level security limits what they can do.
export const supabaseUrl = () => need("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () => need("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
