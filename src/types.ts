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

const MACRO_SCALE = 100;

export const MacroPrecisionErrorMessage = "Macro values cannot have more than two decimal places.";

const hasAtMostTwoDecimalPlaces = (value: number) => Number.isInteger(Math.round(value * MACRO_SCALE));

const RecipeMacroInputSchema = z
  .object({
    kcal: z
      .number({ required_error: "Total calories (kcal) are required." })
      .min(0, "kcal cannot be negative."),
    protein: z
      .number({ required_error: "Protein grams are required." })
      .min(0, "protein cannot be negative."),
    carbs: z
      .number({ required_error: "Carbohydrate grams are required." })
      .min(0, "carbs cannot be negative."),
    fat: z
      .number({ required_error: "Fat grams are required." })
      .min(0, "fat cannot be negative."),
  })
  .superRefine((macros, ctx) => {
    (Object.entries(macros) as Array<[keyof typeof macros, number]>).forEach(([key, value]) => {
      if (!hasAtMostTwoDecimalPlaces(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: MacroPrecisionErrorMessage,
        });
      }
    });
  });

export const RecipeCreateDtoSchema = z.object({
  title: z
    .string({ required_error: "Title is required." })
    .trim()
    .min(1, "Title cannot be empty.")
    .max(200, "Title cannot exceed 200 characters."),
  servings: z
    .number({ required_error: "Servings are required." })
    .int("Servings must be a whole number.")
    .min(1, "Servings must be at least 1.")
    .max(50, "Servings cannot exceed 50."),
  macros: RecipeMacroInputSchema,
  recipeText: z
    .string({ required_error: "Recipe instructions are required." })
    .trim()
    .min(1, "Recipe instructions cannot be empty.")
    .max(10000, "Recipe instructions cannot exceed 10,000 characters."),
  lastAdaptationExplanation: z
    .union([
      z
        .string()
        .trim()
        .min(1, "Adaptation explanation cannot be empty when provided.")
        .max(2000, "Adaptation explanation cannot exceed 2,000 characters."),
      z.literal(null),
    ])
    .optional(),
});

export type RecipeCreateDto = z.infer<typeof RecipeCreateDtoSchema>;

export const RecipeUpdateDtoSchema = RecipeCreateDtoSchema.partial();

export type RecipeUpdateDto = z.infer<typeof RecipeUpdateDtoSchema>;

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

export const RecipeAdaptationAcceptDtoSchema = z.object({
  logId: z
    .string({ required_error: "logId is required." })
    .trim()
    .uuid({ message: "logId must be a valid UUID." }),
  recipeText: RecipeCreateDtoSchema.shape.recipeText,
  macros: RecipeMacroInputSchema,
  explanation: z
    .string({ required_error: "Adaptation explanation is required." })
    .trim()
    .min(1, "Adaptation explanation cannot be empty.")
    .max(2000, "Adaptation explanation cannot exceed 2,000 characters."),
});

export type RecipeAdaptationAcceptDto = z.infer<typeof RecipeAdaptationAcceptDtoSchema>;

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

const optionalIsoDateString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return undefined;
    }

    return trimmed;
  },
  z
    .string()
    .datetime({ offset: true })
    .optional(),
);

export const GetRecipeAdaptationHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).catch(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).catch(10).default(10),
    start: optionalIsoDateString,
    end: optionalIsoDateString,
    sortOrder: z.enum(SortOrders).catch("desc").default("desc"),
  })
  .superRefine((data, ctx) => {
    if (data.start !== undefined && data.end !== undefined) {
      const startDate = Date.parse(data.start);
      const endDate = Date.parse(data.end);

      if (Number.isNaN(startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["start"],
          message: "start must be a valid ISO 8601 date.",
        });
      }

      if (Number.isNaN(endDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["end"],
          message: "end must be a valid ISO 8601 date.",
        });
      }

      if (!Number.isNaN(startDate) && !Number.isNaN(endDate) && startDate > endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["start"],
          message: "start must be earlier than or equal to end.",
        });
      }
    }
  });

export type GetRecipeAdaptationHistoryQuery = z.infer<typeof GetRecipeAdaptationHistoryQuerySchema>;