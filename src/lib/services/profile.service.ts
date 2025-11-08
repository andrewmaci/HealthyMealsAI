import type { SupabaseClient } from "../../db/supabase.client";
import type { Tables, TablesInsert, TablesUpdate } from "../../db/database.types";
import type { ProfileDTO, ProfileUpdateDto } from "../../types";

type ProfileRow = Tables<"profiles">;
type ProfileInsertRow = TablesInsert<"profiles">;

interface ProfileServiceErrorOptions {
  message: string;
  code: "fetch_failed" | "insert_failed" | "provision_failed" | "update_failed" | "precondition_failed";
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

export class ProfileConflictError extends Error {
  public constructor(message = "Profile update conflict detected.") {
    super(message);
    this.name = "ProfileConflictError";
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

interface ProfileProvisionDefaults {
  timezone?: ProfileRow["timezone"];
  allergens?: ProfileRow["allergens"];
  dislikedIngredients?: ProfileRow["disliked_ingredients"];
}

export const getOrCreateProfile = async (
  supabase: SupabaseClient,
  userId: string,
  defaults: ProfileProvisionDefaults = {}
): Promise<ProfileRow> => {
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

  const insertPayload: ProfileInsertRow = {
    id: userId,
    allergens: defaults.allergens ?? [],
    disliked_ingredients: defaults.dislikedIngredients ?? [],
    timezone: defaults.timezone ?? null,
  };
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

const mapDtoToUpdatePayload = (data: ProfileUpdateDto): TablesUpdate<"profiles"> => ({
  allergens: data.allergens,
  disliked_ingredients: data.dislikedIngredients,
  timezone: data.timezone ?? null,
});

const ensureValidConcurrencyHeader = (ifUnmodifiedSince: string) => {
  if (!ifUnmodifiedSince) {
    throw new ProfileServiceError({
      message: "Missing 'If-Unmodified-Since' header.",
      code: "precondition_failed",
    });
  }

  const parsedDate = new Date(ifUnmodifiedSince);
  if (Number.isNaN(parsedDate.valueOf())) {
    throw new ProfileServiceError({
      message: "Invalid 'If-Unmodified-Since' header value.",
      code: "precondition_failed",
    });
  }

  return {
    parsedDate,
    isoString: parsedDate.toISOString(),
    rfc1123String: parsedDate.toUTCString(),
  } as const;
};

export const updateProfile = async (
  supabase: SupabaseClient,
  userId: string,
  data: ProfileUpdateDto,
  ifUnmodifiedSince: string
): Promise<ProfileDTO> => {
  const headerMetadata = ensureValidConcurrencyHeader(ifUnmodifiedSince);

  const { data: currentProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch profile before update", {
      userId,
      error: fetchError,
    });
    throw new ProfileServiceError({
      message: "Unable to retrieve profile for update",
      code: "fetch_failed",
      cause: fetchError,
    });
  }

  if (!currentProfile) {
    console.error("Profile not found before update", { userId });
    throw new ProfileServiceError({
      message: "Profile not found",
      code: "fetch_failed",
    });
  }

  const currentUpdatedAtUtc = new Date(currentProfile.updated_at).toUTCString();

  if (currentUpdatedAtUtc !== headerMetadata.rfc1123String) {
    throw new ProfileConflictError();
  }

  const { error: updateError, data: updatedRow } = await supabase
    .from("profiles")
    .update(mapDtoToUpdatePayload(data))
    .eq("id", userId)
    .eq("updated_at", currentProfile.updated_at)
    .select("*")
    .maybeSingle();

  if (updateError) {
    console.error("Failed to update profile", {
      userId,
      error: updateError,
    });
    throw new ProfileServiceError({
      message: "Unable to update profile",
      code: "update_failed",
      cause: updateError,
    });
  }

  if (!updatedRow) {
    throw new ProfileConflictError();
  }

  return mapProfileRowToDTO(updatedRow);
};
