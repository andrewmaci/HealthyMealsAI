import { z } from "zod";
import type { Tables, TablesInsert, TablesUpdate } from "./db/database.types";

type ProfileRow = Tables<"profiles">;
type RecipeRow = Tables<"recipes">;
type AdaptationLogRow = Tables<"adaptation_logs">;
type RecipeInsert = TablesInsert<"recipes">;
type ProfileUpdateRow = TablesUpdate<"profiles">;

export interface StandardResponse<T> {
  data: T;
}

export interface PaginationDTO {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationDTO;
}

export interface ProfileDTO {
  id: ProfileRow["id"];
  allergens: ProfileRow["allergens"];
  dislikedIngredients: ProfileRow["disliked_ingredients"];
  timezone: ProfileRow["timezone"];
  createdAt: ProfileRow["created_at"];
  updatedAt: ProfileRow["updated_at"];
}

export type ProfileResponseDTO = StandardResponse<ProfileDTO>;

const isValidTimezone = (timezone: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
};

const createPreferenceArraySchema = (fieldLabel: string) =>
  z
    .array(
      z
        .string({ required_error: `${fieldLabel} entry is required.` })
        .transform((value) => value.trim())
        .refine((value) => value.length > 0, {
          message: `${fieldLabel} strings cannot be empty.`,
        }),
    )
    .max(50, `${fieldLabel} list cannot exceed 50 entries.`);

export const ProfileUpdateDtoSchema = z.object({
  allergens: createPreferenceArraySchema("Allergen"),
  dislikedIngredients: createPreferenceArraySchema("Ingredient"),
  timezone: z
    .string()
    .transform((value) => value.trim())
    .refine(isValidTimezone, {
      message: "Invalid timezone identifier.",
    })
    .nullable(),
});

export type ProfileUpdateDto = z.infer<typeof ProfileUpdateDtoSchema>;

export interface ProfileUpdateCommand {
  allergens?: ProfileUpdateRow["allergens"];
  dislikedIngredients?: ProfileUpdateRow["disliked_ingredients"];
  timezone?: ProfileUpdateRow["timezone"];
}

export type RecipeMacroDTO = Pick<RecipeRow, "kcal" | "protein" | "carbs" | "fat">;

export interface RecipeDTO {
  id: RecipeRow["id"];
  title: RecipeRow["title"];
  servings: RecipeRow["servings"];
  macros: RecipeMacroDTO;
  recipeText: RecipeRow["recipe_text"];
  lastAdaptationExplanation: RecipeRow["last_adaptation_explanation"];
  createdAt: RecipeRow["created_at"];
  updatedAt: RecipeRow["updated_at"];
}

export type RecipeResponseDTO = StandardResponse<RecipeDTO>;

export type RecipeListResponseDTO = PaginatedResponse<RecipeDTO>;

export interface RecipeCreateCommand {
  title: RecipeInsert["title"];
  servings: RecipeInsert["servings"];
  macros: RecipeMacroDTO;
  recipeText: RecipeInsert["recipe_text"];
  lastAdaptationExplanation?: RecipeInsert["last_adaptation_explanation"];
}

export type RecipeCreateResponseDTO = StandardResponse<RecipeDTO>;

export type RecipeUpdateCommand = Partial<Omit<RecipeCreateCommand, "macros">> & {
  /**
   * When provided, all macro values must be present; omitting the object leaves macros unchanged.
   */
  macros?: RecipeMacroDTO;
};

export type RecipeUpdateMinimalDTO = Pick<RecipeDTO, "id" | "updatedAt">;

export type RecipeUpdateResponseDTO = StandardResponse<RecipeDTO | RecipeUpdateMinimalDTO>;

export interface RecipeDeleteCommand {
  confirmation?: boolean;
}

export type AdaptationGoal =
  | "remove_allergens"
  | "remove_disliked_ingredients"
  | "reduce_calories"
  | "increase_protein";

export interface RecipeAdaptationRequestCommand {
  goal: AdaptationGoal;
  /**
   * Optional free-form notes supplied by the user; trimmed and capped at 500 characters.
   */
  notes?: string;
}

export interface AdaptationQuotaDTO {
  limit: number;
  used: number;
  remaining: number;
  windowStart: string;
  windowEnd: string;
  /**
   * Timezone resolves from the user's profile, defaulting to 'UTC' when missing.
   */
  timezone: NonNullable<ProfileRow["timezone"]> | "UTC";
}

export interface RecipeAdaptationProposalDTO {
  logId: AdaptationLogRow["id"];
  goal: AdaptationGoal;
  proposedRecipe: {
    recipeText: RecipeRow["recipe_text"];
    macros: RecipeMacroDTO;
  };
  explanation: NonNullable<RecipeRow["last_adaptation_explanation"]>;
  quota: AdaptationQuotaDTO;
  requestMetadata: {
    requestedAt: string;
    notes: string | null;
    disclaimer: string;
  };
}

export type RecipeAdaptationProposalResponseDTO = StandardResponse<RecipeAdaptationProposalDTO>;

export interface RecipeAdaptationAcceptCommand {
  logId: AdaptationLogRow["id"];
  recipeText: RecipeRow["recipe_text"];
  macros: RecipeMacroDTO;
  explanation: NonNullable<RecipeRow["last_adaptation_explanation"]>;
}

export interface RecipeAdaptationHistoryItemDTO {
  id: AdaptationLogRow["id"];
  recipeId: AdaptationLogRow["recipe_id"];
  createdAt: AdaptationLogRow["created_at"];
}

export type RecipeAdaptationHistoryResponseDTO = PaginatedResponse<RecipeAdaptationHistoryItemDTO>;

export type AdaptationQuotaResponseDTO = StandardResponse<AdaptationQuotaDTO>;

export interface HealthStatusDTO {
  status: "ok";
  timestamp: string;
}

export type HealthStatusResponseDTO = StandardResponse<HealthStatusDTO>;

const coerceOptionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return undefined;
    }

    return value;
  }, schema.optional());

const RecipeSortableColumns = ["created_at", "updated_at", "title"] as const;
const SortOrders = ["asc", "desc"] as const;

export const GetRecipesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).catch(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).catch(10).default(10),
    search: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? undefined : value))
      .optional(),
    sortBy: z.enum(RecipeSortableColumns).catch("updated_at").default("updated_at"),
    sortOrder: z.enum(SortOrders).catch("desc").default("desc"),
    minKcal: coerceOptionalNumber(z.coerce.number().min(0)),
    maxKcal: coerceOptionalNumber(z.coerce.number().min(0)),
    minProtein: coerceOptionalNumber(z.coerce.number().min(0)),
    maxProtein: coerceOptionalNumber(z.coerce.number().min(0)),
  })
  .superRefine((data, ctx) => {
    if (data.minKcal !== undefined && data.maxKcal !== undefined && data.minKcal > data.maxKcal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minKcal"],
        message: "minKcal cannot be greater than maxKcal.",
      });
    }

    if (data.minProtein !== undefined && data.maxProtein !== undefined && data.minProtein > data.maxProtein) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minProtein"],
        message: "minProtein cannot be greater than maxProtein.",
      });
    }
  });

export type GetRecipesQuery = z.infer<typeof GetRecipesQuerySchema>;