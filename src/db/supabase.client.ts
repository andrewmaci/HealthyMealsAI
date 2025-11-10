import type { AstroCookies } from "astro";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: true,
};

interface ParsedCookie {
  name: string;
  value: string;
}

function parseCookieHeader(cookieHeader: string): ParsedCookie[] {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader.split(";").reduce<ParsedCookie[]>((accumulator, cookie) => {
    const [name, ...rest] = cookie.trim().split("=");

    if (!name) {
      return accumulator;
    }

    accumulator.push({
      name,
      value: rest.join("="),
    });

    return accumulator;
  }, []);
}

interface SupabaseServerContext {
  headers: Headers;
  cookies: AstroCookies;
}

export const createSupabaseServerInstance = ({ headers, cookies }: SupabaseServerContext) => {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(headers.get("cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: options?.secure ?? import.meta.env.PROD,
            path: options?.path ?? "/",
          });
        });
      },
    },
  });
};

export type SupabaseClient = ReturnType<typeof createSupabaseServerInstance>;
