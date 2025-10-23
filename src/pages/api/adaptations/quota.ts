import type { APIRoute } from "astro";

import { AdaptationServiceError, getAdaptationQuota } from "../../lib/services/adaptation.service";

export const prerender = false;

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

export const GET: APIRoute = async ({ locals }) => {
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const quota = await getAdaptationQuota(locals.supabase, sessionUser.id);

    return buildJsonResponse(quota, 200);
  } catch (error) {
    if (error instanceof AdaptationServiceError) {
      console.error("Adaptation quota service error", {
        userId: sessionUser.id,
        code: error.code,
        error,
      });

      return buildJsonResponse({ error: "Failed to retrieve adaptation quota." }, 500);
    }

    console.error("Unexpected error while fetching adaptation quota", {
      userId: sessionUser.id,
      error,
    });

    return buildJsonResponse({ error: "Failed to retrieve adaptation quota." }, 500);
  }
};

