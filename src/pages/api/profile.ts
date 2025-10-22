import type { APIRoute } from "astro";

import { ProfileUpdateDtoSchema } from "../../types";
import type { ProfileResponseDTO, ProfileUpdateDto } from "../../types";
import {
  getOrCreateProfile,
  mapProfileRowToDTO,
  ProfileConflictError,
  ProfileServiceError,
  updateProfile,
} from "../../lib/services/profile.service";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  try {
    const profileRow = await getOrCreateProfile(locals.supabase, sessionUser.id);
    const profileDTO = mapProfileRowToDTO(profileRow);

    if (!profileDTO.timezone) {
      profileDTO.timezone = "UTC";
    }

    const responseBody: ProfileResponseDTO = {
      data: profileDTO,
    };

    const lastModifiedHeader = new Date(profileDTO.updatedAt).toUTCString();

    return buildJsonResponse(responseBody, 200, {
      "last-modified": lastModifiedHeader,
    });
  } catch (error) {
    if (error instanceof ProfileServiceError) {
      console.error("Profile service error", { userId: sessionUser.id, code: error.code, error });
    } else {
      console.error("Unexpected error while fetching profile", { userId: sessionUser.id, error });
    }

    return new Response(JSON.stringify({ error: "Failed to retrieve profile" }), {
      status: 500,
      headers: {
        "content-type": "application/json",
      },
    });
  }
};

const buildJsonResponse = (body: unknown, status: number, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
  });

export const PUT: APIRoute = async ({ locals, request }) => {
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

  const ifUnmodifiedSince = request.headers.get("if-unmodified-since");

  if (!ifUnmodifiedSince) {
    return buildJsonResponse({ error: "Missing If-Unmodified-Since header." }, 400);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return buildJsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const parseResult = ProfileUpdateDtoSchema.safeParse(payload);

  if (!parseResult.success) {
    return buildJsonResponse(
      {
        error: "Validation failed.",
        details: parseResult.error.flatten(),
      },
      400,
    );
  }

  const validatedPayload: ProfileUpdateDto = parseResult.data;

  try {
    const updatedProfile = await updateProfile(locals.supabase, sessionUser.id, validatedPayload, ifUnmodifiedSince);

    if (!updatedProfile.timezone) {
      updatedProfile.timezone = "UTC";
    }

    const responseBody: ProfileResponseDTO = {
      data: updatedProfile,
    };

    const lastModifiedHeader = new Date(updatedProfile.updatedAt).toUTCString();

    return buildJsonResponse(responseBody, 200, {
      "last-modified": lastModifiedHeader,
    });
  } catch (error) {
    if (error instanceof ProfileConflictError) {
      return buildJsonResponse({ error: "Profile has been modified by another process." }, 409);
    }

    if (error instanceof ProfileServiceError) {
      const status = error.code === "precondition_failed" ? 400 : 500;
      console.error("Profile update service error", {
        userId: sessionUser.id,
        code: error.code,
        error,
      });
      return buildJsonResponse({ error: error.message }, status);
    }

    console.error("Unexpected error while updating profile", {
      userId: sessionUser.id,
      error,
    });

    return buildJsonResponse({ error: "Failed to update profile." }, 500);
  }
};
