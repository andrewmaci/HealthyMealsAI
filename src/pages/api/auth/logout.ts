import type { APIRoute } from "astro";

export const prerender = false;

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

export const POST: APIRoute = async ({ locals }) => {
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

  const { error } = await locals.supabase.auth.signOut();

  if (error) {
    console.error("Failed to sign out user", {
      userId: sessionUser.id,
      error,
    });

    return buildJsonResponse({ error: "Failed to sign out." }, 500);
  }

  return new Response(null, { status: 204 });
};


