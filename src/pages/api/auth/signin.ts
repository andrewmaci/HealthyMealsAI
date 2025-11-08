import type { APIRoute } from "astro";
import { z } from "zod";

import { getOrCreateProfile, ProfileServiceError } from "../../../lib/services/profile.service";

export const prerender = false;

const SignInRequestSchema = z.object({
  email: z.string({ required_error: "Email is required." }).trim().email("Invalid email or password format."),
  password: z.string({ required_error: "Password is required." }).min(6, "Password must be at least 6 characters."),
});

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const mapAuthError = (error: unknown): { status: number; message: string } => {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: string }).message ?? "");

    switch (message) {
      case "Invalid login credentials":
        return { status: 401, message: "Invalid email or password." };
      case "Email not confirmed":
        return { status: 403, message: "Please confirm your email address before signing in." };
      case "Too many requests":
        return { status: 429, message: "Too many login attempts. Please try again later." };
      default:
        break;
    }
  }

  return {
    status: 500,
    message: "Unable to sign in. Please try again later.",
  };
};

export const POST: APIRoute = async ({ request, locals }) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return buildJsonResponse(
      {
        error: "Invalid JSON payload.",
      },
      400
    );
  }

  const parseResult = SignInRequestSchema.safeParse(payload);

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

  const { email, password } = parseResult.data;

  const { data, error } = await locals.supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    const { status, message } = mapAuthError(error);

    return buildJsonResponse(
      {
        error: message,
      },
      status
    );
  }

  try {
    await getOrCreateProfile(locals.supabase, data.user.id);
  } catch (profileError) {
    if (profileError instanceof ProfileServiceError) {
      console.error("Failed to provision user profile after sign-in", {
        userId: data.user.id,
        code: profileError.code,
        error: profileError,
      });
    } else {
      console.error("Unexpected error while provisioning profile after sign-in", {
        userId: data.user.id,
        error: profileError,
      });
    }
  }

  return buildJsonResponse({ success: true }, 200);
};
