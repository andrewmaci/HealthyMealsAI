import type { APIRoute } from "astro";

import type { ProfileResponseDTO } from "../../types";
import { getOrCreateProfile, mapProfileRowToDTO, ProfileServiceError } from "../../lib/services/profile.service";

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

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
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
