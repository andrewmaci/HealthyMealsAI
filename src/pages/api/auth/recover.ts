import type { APIRoute } from "astro";
import { z } from "zod";

export const prerender = false;

const RecoverRequestSchema = z.object({
  email: z.string({ required_error: "Email is required." }).trim().email("Invalid email format."),
});

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return buildJsonResponse({ error: "Invalid JSON payload." }, 400);
  }

  const parseResult = RecoverRequestSchema.safeParse(payload);

  if (!parseResult.success) {
    const { fieldErrors } = parseResult.error.flatten();

    return buildJsonResponse(
      {
        error: "Validation failed.",
        details: {
          fieldErrors,
        },
      },
      400
    );
  }

  const { email } = parseResult.data;

  const resetUrl = new URL("/auth/reset", request.url);

  const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resetUrl.toString(),
  });

  if (error) {
    console.error("Failed to initiate password recovery", {
      email,
      error,
    });
  }

  return buildJsonResponse({ success: true }, 200);
};
