import type { APIRoute } from "astro";
import { z } from "zod";

import { getOrCreateProfile, ProfileServiceError } from "../../../lib/services/profile.service";

export const prerender = false;

const isValidTimezone = (timezone: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const SignUpRequestSchema = z.object({
  email: z.string({ required_error: "Email is required." }).trim().email("Invalid email or password format."),
  password: z
    .string({ required_error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
  timezone: z
    .string({ required_error: "Timezone is required." })
    .trim()
    .min(1, "Timezone is required.")
    .refine(isValidTimezone, "Invalid timezone identifier."),
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
      case "User already registered":
        return { status: 409, message: "An account with this email already exists." };
      case "Password should be at least 6 characters":
        return { status: 400, message: "Password must be at least 8 characters." };
      case "Invalid email address":
        return { status: 400, message: "Invalid email or password format." };
      case "Too many requests":
        return { status: 429, message: "Too many sign-up attempts. Please try again later." };
      default:
        break;
    }
  }

  return {
    status: 500,
    message: "Unable to create account. Please try again later.",
  };
};

export const POST: APIRoute = async ({ request, locals, url }) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return buildJsonResponse({ error: "Invalid JSON payload." }, 400);
  }

  const parseResult = SignUpRequestSchema.safeParse(payload);

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

  const { email, password, timezone } = parseResult.data;

  // Build the confirmation redirect URL based on the environment
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || url.origin;
  const emailRedirectTo = `${siteUrl}/auth/confirm`;

  const { data, error } = await locals.supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
    },
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

  // If no session is returned, email confirmation is required
  if (!data.session) {
    console.log("Email confirmation required for user", {
      userId: data.user.id,
      email: data.user.email,
    });

    return buildJsonResponse(
      {
        success: true,
        requiresEmailConfirmation: true,
        message: "Please check your email to confirm your account.",
      },
      201
    );
  }

  try {
    const profile = await getOrCreateProfile(locals.supabase, data.user.id, {
      timezone,
      allergens: [],
      dislikedIngredients: [],
    });

    if (!profile.timezone) {
      const { error: updateError } = await locals.supabase.from("profiles").update({ timezone }).eq("id", data.user.id);

      if (updateError && updateError.code !== "PGRST116") {
        console.error("Failed to update profile timezone after sign-up", {
          userId: data.user.id,
          error: updateError,
        });
      }
    }
  } catch (profileError) {
    if (profileError instanceof ProfileServiceError) {
      console.error("Failed to provision profile during sign-up", {
        userId: data.user.id,
        code: profileError.code,
        error: profileError,
      });
    } else {
      console.error("Unexpected error while provisioning profile during sign-up", {
        userId: data.user.id,
        error: profileError,
      });
    }
  }

  return buildJsonResponse({ success: true }, 201);
};
