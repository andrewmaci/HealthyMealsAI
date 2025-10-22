import type { SupabaseClient } from "../../db/supabase.client";
import type { Tables, TablesInsert } from "../../db/database.types";
import type { ProfileDTO } from "../../types";

type ProfileRow = Tables<"profiles">;
type ProfileInsertRow = TablesInsert<"profiles">;

interface ProfileServiceErrorOptions {
  message: string;
  code: "fetch_failed" | "insert_failed" | "provision_failed";
  cause?: unknown;
}

export class ProfileServiceError extends Error {
  public readonly code: ProfileServiceErrorOptions["code"];

  public constructor(options: ProfileServiceErrorOptions) {
    super(options.message);
    this.name = "ProfileServiceError";
    this.code = options.code;
    if (options.cause) {
      // Maintain original stack when supported by the runtime.
      this.cause = options.cause;
    }
  }
}

export const mapProfileRowToDTO = (row: ProfileRow): ProfileDTO => ({
  id: row.id,
  allergens: row.allergens,
  dislikedIngredients: row.disliked_ingredients,
  timezone: row.timezone,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getOrCreateProfile = async (supabase: SupabaseClient, userId: string): Promise<ProfileRow> => {
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch profile", { userId, error: fetchError });
    throw new ProfileServiceError({
      message: "Unable to retrieve profile",
      code: "fetch_failed",
      cause: fetchError,
    });
  }

  if (profile) {
    return profile;
  }

  const insertPayload: ProfileInsertRow = { id: userId };
  const { data: insertedProfile, error: insertError } = await supabase
    .from("profiles")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insertError) {
    console.error("Failed to provision profile", { userId, error: insertError });
    throw new ProfileServiceError({
      message: "Unable to provision profile",
      code: "insert_failed",
      cause: insertError,
    });
  }

  if (!insertedProfile) {
    console.error("Profile provisioning returned no data", { userId });
    throw new ProfileServiceError({
      message: "Provisioned profile is missing",
      code: "provision_failed",
    });
  }

  return insertedProfile;
};

