/**
 * Supabase generated types.
 * Run: supabase gen types typescript --project-id YOUR_REF > types/supabase.ts
 * Until then, minimal placeholder for TypeScript.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
}
