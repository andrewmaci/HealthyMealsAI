/// <reference types="astro/client" />

import type { Database } from "./db/database.types.ts";
import type { SupabaseClient } from "./db/supabase.client";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      session: {
        user: {
          id: Database["public"]["Tables"]["profiles"]["Row"]["id"];
          email: string;
        };
      } | null;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly OPENROUTER_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
