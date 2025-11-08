import type { ProfileDTO, ProfileResponseDTO, ProfileUpdateDto } from "@/types";

export type ProfileFormValues = ProfileUpdateDto;

export interface ProfileFormErrors {
  allergens?: string;
  dislikedIngredients?: string;
  timezone?: string;
  form?: string;
}

export type SaveSuccessHandler = (next: ProfileDTO, lastModified: string) => void;

export type SaveError =
  | { kind: "validation"; details?: string }
  | { kind: "conflict" }
  | { kind: "unauthorized" }
  | { kind: "network"; message?: string }
  | { kind: "server"; message?: string };

export interface UseProfileResult {
  status: "idle" | "loading" | "success" | "error" | "unauthorized";
  data: ProfileDTO | null;
  lastModified: string | null;
  error: unknown | null;
  refetch: () => Promise<void>;
}

export interface UseSaveProfileOptions {
  lastModified: string | null;
  onSuccess?: (next: ProfileDTO, lastModified: string) => void;
  onConflict?: () => void;
  onUnauthorized?: () => void;
  onValidation?: (message?: string) => void;
  onNetwork?: (message?: string) => void;
  onServer?: (message?: string) => void;
}

export interface UseSaveProfileResult {
  save: (values: ProfileUpdateDto) => Promise<void>;
  saving: boolean;
}

export type ProfileResponseBody = ProfileResponseDTO;
