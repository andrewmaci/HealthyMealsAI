import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "../../src/db/database.types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

export default async function globalTeardown() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_KEY environment variables for teardown.");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const { error } = await supabase.from("recipes").delete().not("id", "is", null);

  if (error) {
    throw new Error(`Failed to clean up recipes table: ${error.message}`);
  }
}
