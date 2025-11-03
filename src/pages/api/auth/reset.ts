import type { APIRoute } from "astro";
import { z } from "zod";

export const prerender = false;

const ResetPasswordRequestSchema = z.object({
  token: z
    .string({ required_error: "Token is required." })
    .trim()
    .min(1, "Token is required."),
  password: z
    .string({ required_error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
});

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const mapUpdateError = (error: unknown): { status: number; message: string } => {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: string }).message ?? "");

    switch (message) {
      case "Password should be at least 6 characters":
        return { status: 400, message: "Password must be at least 8 characters." };
      case "Current session is missing or invalid":
        return { status: 400, message: "This password reset link is invalid or has expired." };
      default:
        break;
    }
  }

  return {
    status: 500,
    message: "Unable to reset password. Please try again later.",
  };
};

export const POST: APIRoute = async ({ request, locals }) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return buildJsonResponse({ error: "Invalid JSON payload." }, 400);
  }

  const parseResult = ResetPasswordRequestSchema.safeParse(payload);

  if (!parseResult.success) {
    const { fieldErrors } = parseResult.error.flatten();

    return buildJsonResponse(
      {
        error: "Validation failed.",
        details: {
          fieldErrors,
        },
      },
      400,
    );
  }

  const {
    password,
  } = parseResult.data;

  const {
    data: { session },
  } = await locals.supabase.auth.getSession();

  if (!session) {
    return buildJsonResponse({ error: "This password reset link is invalid or has expired." }, 400);
  }

  const { error } = await locals.supabase.auth.updateUser({ password });

  if (error) {
    const { status, message } = mapUpdateError(error);

    return buildJsonResponse({ error: message }, status);
  }

  return buildJsonResponse({ success: true }, 200);
};


