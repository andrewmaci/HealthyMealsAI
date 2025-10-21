import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./db/database.types"

type ProfileRow = Tables<"profiles">
type RecipeRow = Tables<"recipes">
type AdaptationLogRow = Tables<"adaptation_logs">
type RecipeInsert = TablesInsert<"recipes">
type ProfileUpdateRow = TablesUpdate<"profiles">

export type StandardResponse<T> = {
  data: T
}

export type PaginationDTO = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: PaginationDTO
}

export type ProfileDTO = {
  id: ProfileRow["id"]
  allergens: ProfileRow["allergens"]
  dislikedIngredients: ProfileRow["disliked_ingredients"]
  timezone: ProfileRow["timezone"]
  createdAt: ProfileRow["created_at"]
  updatedAt: ProfileRow["updated_at"]
}

export type ProfileResponseDTO = StandardResponse<ProfileDTO>

export type ProfileUpdateCommand = {
  allergens?: ProfileUpdateRow["allergens"]
  dislikedIngredients?: ProfileUpdateRow["disliked_ingredients"]
  timezone?: ProfileUpdateRow["timezone"]
}

export type RecipeMacroDTO = Pick<
  RecipeRow,
  "kcal" | "protein" | "carbs" | "fat"
>

export type RecipeDTO = {
  id: RecipeRow["id"]
  title: RecipeRow["title"]
  servings: RecipeRow["servings"]
  macros: RecipeMacroDTO
  recipeText: RecipeRow["recipe_text"]
  lastAdaptationExplanation: RecipeRow["last_adaptation_explanation"]
  createdAt: RecipeRow["created_at"]
  updatedAt: RecipeRow["updated_at"]
}

export type RecipeResponseDTO = StandardResponse<RecipeDTO>

export type RecipeListResponseDTO = PaginatedResponse<RecipeDTO>

export type RecipeCreateCommand = {
  title: RecipeInsert["title"]
  servings: RecipeInsert["servings"]
  macros: RecipeMacroDTO
  recipeText: RecipeInsert["recipe_text"]
  lastAdaptationExplanation?: RecipeInsert["last_adaptation_explanation"]
}

export type RecipeCreateResponseDTO = StandardResponse<RecipeDTO>

export type RecipeUpdateCommand = Partial<
  Omit<RecipeCreateCommand, "macros">
> & {
  /**
   * When provided, all macro values must be present; omitting the object leaves macros unchanged.
   */
  macros?: RecipeMacroDTO
}

export type RecipeUpdateMinimalDTO = Pick<RecipeDTO, "id" | "updatedAt">

export type RecipeUpdateResponseDTO = StandardResponse<
  RecipeDTO | RecipeUpdateMinimalDTO
>

export type RecipeDeleteCommand = {
  confirmation?: boolean
}

export type AdaptationGoal =
  | "remove_allergens"
  | "remove_disliked_ingredients"
  | "reduce_calories"
  | "increase_protein"

export type RecipeAdaptationRequestCommand = {
  goal: AdaptationGoal
  /**
   * Optional free-form notes supplied by the user; trimmed and capped at 500 characters.
   */
  notes?: string
}

export type AdaptationQuotaDTO = {
  limit: number
  used: number
  remaining: number
  windowStart: string
  windowEnd: string
  /**
   * Timezone resolves from the user's profile, defaulting to 'UTC' when missing.
   */
  timezone: NonNullable<ProfileRow["timezone"]> | "UTC"
}

export type RecipeAdaptationProposalDTO = {
  logId: AdaptationLogRow["id"]
  goal: AdaptationGoal
  proposedRecipe: {
    recipeText: RecipeRow["recipe_text"]
    macros: RecipeMacroDTO
  }
  explanation: NonNullable<RecipeRow["last_adaptation_explanation"]>
  quota: AdaptationQuotaDTO
  requestMetadata: {
    requestedAt: string
    notes: string | null
    disclaimer: string
  }
}

export type RecipeAdaptationProposalResponseDTO =
  StandardResponse<RecipeAdaptationProposalDTO>

export type RecipeAdaptationAcceptCommand = {
  logId: AdaptationLogRow["id"]
  recipeText: RecipeRow["recipe_text"]
  macros: RecipeMacroDTO
  explanation: NonNullable<RecipeRow["last_adaptation_explanation"]>
}

export type RecipeAdaptationHistoryItemDTO = {
  id: AdaptationLogRow["id"]
  recipeId: AdaptationLogRow["recipe_id"]
  createdAt: AdaptationLogRow["created_at"]
}

export type RecipeAdaptationHistoryResponseDTO =
  PaginatedResponse<RecipeAdaptationHistoryItemDTO>

export type AdaptationQuotaResponseDTO = StandardResponse<AdaptationQuotaDTO>

export type HealthStatusDTO = {
  status: "ok"
  timestamp: string
}

export type HealthStatusResponseDTO = StandardResponse<HealthStatusDTO>

