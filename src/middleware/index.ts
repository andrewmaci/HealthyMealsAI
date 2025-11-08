import { defineMiddleware } from "astro:middleware";

import { createSupabaseServerInstance } from "../db/supabase.client";

const PUBLIC_ROUTES = new Set(["/auth/signin", "/auth/signup", "/auth/recover", "/auth/reset", "/auth/confirm"]);

const PUBLIC_API_ROUTES = [
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/recover",
  "/api/auth/reset",
  "/api/auth/confirm",
  "/api/auth/logout",
  "/api/health",
];

const ASSET_PREFIXES = ["/_astro/", "/assets/", "/_image/"];

const ASSET_FILES = new Set(["/favicon.png", "/favicon.ico", "/manifest.webmanifest", "/robots.txt"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, url, locals, redirect } = context;

  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    return next();
  }

  if (ASSET_FILES.has(pathname) || ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return next();
  }

  const supabase = createSupabaseServerInstance({
    headers: request.headers,
    cookies,
  });

  locals.supabase = supabase;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    locals.session = {
      user: {
        id: session.user.id,
        email: session.user.email ?? "",
      },
    };
  } else {
    locals.session = null;
  }

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const isPublicApiRoute = PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isAuthRoute = pathname.startsWith("/auth/");

  if (locals.session && isAuthRoute) {
    return redirect("/recipes");
  }

  if (!locals.session && !isPublicRoute && !isPublicApiRoute) {
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    const loginUrl = new URL("/auth/signin", url);
    const redirectTarget = `${pathname}${url.search}`;

    if (redirectTarget && redirectTarget !== "/auth/signin") {
      loginUrl.searchParams.set("redirect", redirectTarget);
    }

    return redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  return next();
});
