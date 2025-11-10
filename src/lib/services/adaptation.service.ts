import type { Tables, TablesInsert } from "../../db/database.types";
import type { SupabaseClient } from "../../db/supabase.client";
import type {
  AdaptationPendingResponseDTO,
  AdaptationQuotaDTO,
  AdaptationQuotaResponseDTO,
  GetRecipeAdaptationHistoryQuery,
  RecipeAdaptationAcceptCommand,
  RecipeAdaptationHistoryItemDTO,
  RecipeAdaptationHistoryResponseDTO,
  RecipeAdaptationProposalDTO,
  RecipeAdaptationRequestCommand,
  RecipeDTO,
} from "../../types";
import {
  buildSystemMessage,
  buildUserMessage,
  createStructuredChatCompletion,
  OpenRouterServiceError,
  type JsonSchema,
  type ResponseFormat,
} from "./openrouter.service";

interface AdaptationQuotaUsage {
  limit: number;
  used: number;
  remaining: number;
  windowStart: string;
  windowEnd: string;
  timezone: AdaptationQuotaDTO["timezone"];
}

interface AdaptationProposalResult {
  status: "completed";
  proposal: RecipeAdaptationProposalDTO;
}

interface AdaptationPendingResult {
  status: "pending";
  response: AdaptationPendingResponseDTO;
}

type ProposeAdaptationResult = AdaptationProposalResult | AdaptationPendingResult;

type AdaptationServiceErrorCode =
  | "recipe_not_found"
  | "history_fetch_failed"
  | "history_count_failed"
  | "proposal_not_found"
  | "accept_failed"
  | "quota_fetch_failed"
  | "adaptation_log_failed"
  | "ai_timeout"
  | "ai_unprocessable"
  | "quota_exceeded"
  | "unauthorized"
  | "idempotency_conflict"
  | "proposal_generation_failed"
  | "adaptation_in_progress"
  | "invalid_idempotency_key";

interface AdaptationServiceErrorOptions {
  code: AdaptationServiceErrorCode;
  message: string;
  cause?: unknown;
}

export class AdaptationServiceError extends Error {
  public readonly code: AdaptationServiceErrorCode;

  public constructor(options: AdaptationServiceErrorOptions) {
    super(options.message);
    this.name = "AdaptationServiceError";
    this.code = options.code;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

const DAILY_ADAPTATION_LIMIT_FALLBACK = 20;
const IDEMPOTENCY_KEY_MAX_LENGTH = 64;
const ADAPTATION_DISCLAIMER =
  "This adaptation is AI-generated. Review carefully and consult a professional for personalized dietary guidance.";

const idempotencyCache = new Map<string, ProposeAdaptationResult>();
const inFlightAdaptations = new Set<string>();

const getDailyAdaptationLimit = () => {
  const rawLimit = import.meta.env?.DAILY_ADAPTATION_LIMIT;

  if (typeof rawLimit !== "string" || rawLimit.trim().length === 0) {
    return DAILY_ADAPTATION_LIMIT_FALLBACK;
  }

  const parsed = Number.parseInt(rawLimit, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DAILY_ADAPTATION_LIMIT_FALLBACK;
  }

  return parsed;
};

const parseTimezoneOffsetMinutes = (offsetRaw: string): number => {
  const match = offsetRaw.match(/UTC([+-])(\d{2})(?::?(\d{2}))?/i);

  if (!match) {
    return 0;
  }

  const [, signSymbol, hoursString, minutesString] = match;
  const sign = signSymbol === "-" ? -1 : 1;
  const hours = Number.parseInt(hoursString, 10);
  const minutes = minutesString ? Number.parseInt(minutesString, 10) : 0;

  return sign * (hours * 60 + minutes);
};

const resolveDailyWindowUtc = (now: Date, timeZone: string) => {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const dateParts = dateFormatter.formatToParts(now);
  const year = Number.parseInt(dateParts.find((part) => part.type === "year")?.value ?? "", 10);
  const month = Number.parseInt(dateParts.find((part) => part.type === "month")?.value ?? "", 10);
  const day = Number.parseInt(dateParts.find((part) => part.type === "day")?.value ?? "", 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new AdaptationServiceError({
      code: "quota_fetch_failed",
      message: `Unable to resolve date components for timezone '${timeZone}'.`,
    });
  }

  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const offsetParts = offsetFormatter.formatToParts(now);
  const offsetRaw = offsetParts.find((part) => part.type === "timeZoneName")?.value ?? "UTC";
  const offsetMinutes = parseTimezoneOffsetMinutes(offsetRaw);

  const startUtcMillis = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000;
  const endUtcMillis = startUtcMillis + 24 * 60 * 60 * 1000;

  return {
    start: new Date(startUtcMillis).toISOString(),
    end: new Date(endUtcMillis).toISOString(),
  } as const;
};

const buildQuotaDto = (
  limit: number,
  used: number,
  windowStart: string,
  windowEnd: string,
  timezone: AdaptationQuotaDTO["timezone"]
): AdaptationQuotaDTO => ({
  limit,
  used,
  remaining: Math.max(limit - used, 0),
  windowStart,
  windowEnd,
  timezone,
});

const buildIdempotencyCacheKey = (userId: string, recipeId: string, key: string) => `${userId}:${recipeId}:${key}`;

const buildInFlightKey = (userId: string, recipeId: string) => `${userId}:${recipeId}`;

const mapRecipeRowToDTO = (row: Tables<"recipes">): RecipeDTO => ({
  id: row.id,
  title: row.title,
  servings: row.servings,
  macros: {
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  },
  recipeText: row.recipe_text,
  lastAdaptationExplanation: row.last_adaptation_explanation,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

interface AiAdaptationInput {
  recipe: RecipeDTO;
  profile: {
    allergens: string[];
    dislikedIngredients: string[];
    timezone: AdaptationQuotaDTO["timezone"];
  };
  command: RecipeAdaptationRequestCommand;
}

interface AiAdaptationResponse {
  recipeText: string;
  macros: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  explanation: string;
}

/**
 * Builds the system prompt for recipe adaptation
 */
const buildAdaptationSystemPrompt = (): string => {
  return `You are an expert nutritionist and chef specializing in recipe adaptations. Your role is to modify recipes based on specific dietary goals while maintaining taste, feasibility, and nutritional accuracy.

**Your responsibilities:**
1. Adapt recipes to meet the specified goal (e.g., reduce calories, increase protein)
2. Respect user allergens and ingredient dislikes - completely remove or substitute these
3. Provide accurate macronutrient calculations for the adapted recipe
4. Explain the changes made in a clear, professional manner
5. Ensure the adapted recipe is practical and achievable

**Guidelines:**
- For "remove_allergens": Completely remove allergenic ingredients and substitute with safe, equivalent alternatives
- For "remove_disliked_ingredients": Remove disliked ingredients and substitute with preferred alternatives that maintain the dish's character
- For "reduce_calories": Reduce by ~10-15% through lower-calorie substitutions, reduced portions, or cooking method changes
- For "increase_protein": Increase protein by ~20-30% by adding protein-rich ingredients or larger portions of protein sources
- Always recalculate macros accurately based on the new ingredients and portions
- Maintain the recipe's appeal and practicality
- Be specific about ingredient substitutions and quantity changes
- Format the recipe text in clear markdown with sections for ingredients and instructions`;
};

/**
 * Builds the user prompt with recipe details and adaptation requirements
 */
const buildAdaptationUserPrompt = (input: AiAdaptationInput): string => {
  const { recipe, profile, command } = input;

  const sections: string[] = [];

  // Recipe details
  sections.push("**Original Recipe:**");
  sections.push(`Title: ${recipe.title}`);
  sections.push(`Servings: ${recipe.servings}`);
  sections.push(
    `Current Macros: ${recipe.macros.kcal} kcal, ${recipe.macros.protein}g protein, ${recipe.macros.carbs}g carbs, ${recipe.macros.fat}g fat`
  );
  sections.push("");
  sections.push("**Recipe Content:**");
  sections.push(recipe.recipeText);
  sections.push("");

  // Adaptation goal
  sections.push("**Adaptation Goal:**");
  const goalDescriptions: Record<RecipeAdaptationRequestCommand["goal"], string> = {
    remove_allergens: "Remove allergens and substitute with safe alternatives",
    remove_disliked_ingredients: "Remove disliked ingredients and substitute with preferred alternatives",
    reduce_calories: "Reduce calories while maintaining satiety and nutrition",
    increase_protein: "Increase protein content for muscle building or maintenance",
  };
  sections.push(goalDescriptions[command.goal]);
  sections.push("");

  // User constraints
  if (profile.allergens.length > 0 || profile.dislikedIngredients.length > 0) {
    sections.push("**CRITICAL Constraints:**");
    if (profile.allergens.length > 0) {
      sections.push(
        `- ALLERGENS TO AVOID: ${profile.allergens.join(", ")} - These MUST be completely removed or substituted`
      );
    }
    if (profile.dislikedIngredients.length > 0) {
      sections.push(
        `- DISLIKED INGREDIENTS: ${profile.dislikedIngredients.join(", ")} - These should be removed or substituted`
      );
    }
    sections.push("");
  }

  // Additional notes
  if (command.notes && command.notes.trim().length > 0) {
    sections.push("**Additional User Requirements:**");
    sections.push(command.notes);
    sections.push("");
  }

  sections.push("**Instructions:**");
  sections.push(
    "Provide a fully adapted recipe with accurate macro calculations. Ensure all allergens and disliked ingredients are completely removed or substituted."
  );

  return sections.join("\n");
};

/**
 * Defines the JSON schema for structured AI response
 */
const getAdaptationResponseSchema = (): JsonSchema => ({
  type: "object",
  properties: {
    recipeText: {
      type: "string",
      description: "The complete adapted recipe in markdown format, including title, ingredients, and instructions",
    },
    macros: {
      type: "object",
      properties: {
        kcal: {
          type: "number",
          description: "Total calories per serving",
        },
        protein: {
          type: "number",
          description: "Protein in grams per serving",
        },
        carbs: {
          type: "number",
          description: "Carbohydrates in grams per serving",
        },
        fat: {
          type: "number",
          description: "Fat in grams per serving",
        },
      },
      required: ["kcal", "protein", "carbs", "fat"],
      additionalProperties: false,
    },
    explanation: {
      type: "string",
      description: "A clear explanation of the changes made, why they were made, and how they achieve the goal",
    },
  },
  required: ["recipeText", "macros", "explanation"],
  additionalProperties: false,
});

/**
 * Generates a recipe adaptation using OpenRouter AI
 */
const generateAiAdaptation = async (input: AiAdaptationInput): Promise<AiAdaptationResponse> => {
  console.log("Starting AI adaptation generation", {
    recipeId: input.recipe.id,
    goal: input.command.goal,
    hasProfile: !!input.profile,
  });

  const systemMessage = buildSystemMessage(buildAdaptationSystemPrompt());
  const userMessage = buildUserMessage(buildAdaptationUserPrompt(input));

  const responseFormat: ResponseFormat = {
    type: "json_schema",
    json_schema: {
      name: "recipe_adaptation_response",
      strict: true,
      schema: getAdaptationResponseSchema(),
    },
  };

  console.log("Calling OpenRouter API for adaptation", {
    messageCount: 2,
    schema: responseFormat.json_schema.name,
  });

  try {
    const response = await createStructuredChatCompletion<AiAdaptationResponse>(
      [systemMessage, userMessage],
      responseFormat,
      {
        parameters: {
          temperature: 0.7,
          max_tokens: 2000,
        },
      }
    );

    console.log("OpenRouter API call successful", {
      hasRecipeText: !!response.data.recipeText,
      hasMacros: !!response.data.macros,
      hasExplanation: !!response.data.explanation,
    });

    // Round macros to 2 decimal places
    const adaptedMacros = {
      kcal: roundToTwo(response.data.macros.kcal),
      protein: roundToTwo(response.data.macros.protein),
      carbs: roundToTwo(response.data.macros.carbs),
      fat: roundToTwo(response.data.macros.fat),
    };

    return {
      recipeText: response.data.recipeText,
      macros: adaptedMacros,
      explanation: response.data.explanation,
    };
  } catch (error) {
    // Map OpenRouter errors to Adaptation errors
    if (error instanceof OpenRouterServiceError) {
      console.error("OpenRouter API error during adaptation", {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      });

      // Map specific OpenRouter errors to adaptation errors
      if (error.code === "rate_limit_error" || error.code === "quota_exceeded_error") {
        throw new AdaptationServiceError({
          code: "quota_exceeded",
          message: "AI service quota exceeded. Please try again later.",
          cause: error,
        });
      }

      if (error.code === "timeout_error") {
        throw new AdaptationServiceError({
          code: "ai_timeout",
          message: "AI service request timed out. Please try again.",
          cause: error,
        });
      }

      if (error.code === "authentication_error" || error.code === "configuration_error") {
        throw new AdaptationServiceError({
          code: "proposal_generation_failed",
          message: "AI service configuration error. Please contact support.",
          cause: error,
        });
      }

      // Generic AI error
      throw new AdaptationServiceError({
        code: "ai_unprocessable",
        message: "Unable to process adaptation request. Please try again.",
        cause: error,
      });
    }

    // Unexpected error
    throw new AdaptationServiceError({
      code: "proposal_generation_failed",
      message: "Failed to generate recipe adaptation.",
      cause: error,
    });
  }
};

const ensureIdempotencyKey = (key: string | undefined) => {
  if (!key) {
    return;
  }

  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new AdaptationServiceError({
      code: "invalid_idempotency_key",
      message: `Idempotency key cannot exceed ${IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
    });
  }
};

const mapHistoryRowToDTO = (row: {
  id: string;
  recipe_id: string | null;
  created_at: string;
}): RecipeAdaptationHistoryItemDTO => ({
  id: row.id,
  recipeId: row.recipe_id,
  createdAt: row.created_at,
});

const applyHistoryFilters = (builder: ReturnType<SupabaseClient["from"]>, query: GetRecipeAdaptationHistoryQuery) => {
  let chained = builder;

  if (query.start) {
    chained = chained.gte("created_at", query.start);
  }

  if (query.end) {
    chained = chained.lte("created_at", query.end);
  }

  return chained;
};

export const getAdaptationHistory = async (
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  query: GetRecipeAdaptationHistoryQuery
): Promise<RecipeAdaptationHistoryResponseDTO> => {
  const { count: recipeCount, error: recipeError } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (recipeError) {
    console.error("Failed to verify recipe ownership", {
      userId,
      recipeId,
      error: recipeError,
    });

    throw new AdaptationServiceError({
      code: "history_fetch_failed",
      message: "Unable to verify recipe ownership.",
      cause: recipeError,
    });
  }

  if ((recipeCount ?? 0) === 0) {
    throw new AdaptationServiceError({
      code: "recipe_not_found",
      message: "Recipe not found.",
    });
  }

  const rangeStart = (query.page - 1) * query.pageSize;
  const rangeEnd = rangeStart + query.pageSize - 1;

  const countPromise = applyHistoryFilters(
    supabase
      .from("adaptation_logs")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .eq("recipe_id", recipeId),
    query
  ).maybeSingle();

  const dataPromise = applyHistoryFilters(
    supabase
      .from("adaptation_logs")
      .select("id, recipe_id, created_at")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId),
    query
  )
    .order("created_at", { ascending: query.sortOrder === "asc" })
    .range(rangeStart, rangeEnd);

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([countPromise, dataPromise]);

  if (countError) {
    console.error("Failed to count adaptation history", {
      userId,
      recipeId,
      query,
      error: countError,
    });

    throw new AdaptationServiceError({
      code: "history_count_failed",
      message: "Unable to count adaptation history records.",
      cause: countError,
    });
  }

  if (dataError) {
    console.error("Failed to fetch adaptation history", {
      userId,
      recipeId,
      query,
      error: dataError,
    });

    throw new AdaptationServiceError({
      code: "history_fetch_failed",
      message: "Unable to fetch adaptation history.",
      cause: dataError,
    });
  }

  const totalItems = count ?? data?.length ?? 0;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    data: (data ?? []).map(mapHistoryRowToDTO),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  } satisfies RecipeAdaptationHistoryResponseDTO;
};

type RecipeRow = Tables<"recipes">;

export const acceptAdaptation = async (
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  command: RecipeAdaptationAcceptCommand
): Promise<RecipeDTO> => {
  const { data: logEntry, error: logError } = await supabase
    .from("adaptation_logs")
    .select("id, recipe_id, user_id")
    .eq("id", command.logId)
    .eq("recipe_id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (logError) {
    console.error("Failed to fetch adaptation log for acceptance", {
      userId,
      recipeId,
      command,
      error: logError,
    });
    throw new AdaptationServiceError({
      code: "history_fetch_failed",
      message: "Unable to fetch adaptation log.",
      cause: logError,
    });
  }

  if (!logEntry) {
    console.warn("Adaptation log not found for acceptance", {
      userId,
      recipeId,
      command,
    });
    throw new AdaptationServiceError({
      code: "proposal_not_found",
      message: "Adaptation proposal not found.",
    });
  }

  // Verify recipe ownership separately
  const { data: recipeEntry, error: recipeError } = await supabase
    .from("recipes")
    .select("id, user_id")
    .eq("id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (recipeError) {
    console.error("Failed to verify recipe ownership for acceptance", {
      userId,
      recipeId,
      command,
      error: recipeError,
    });
    throw new AdaptationServiceError({
      code: "history_fetch_failed",
      message: "Unable to verify recipe ownership.",
      cause: recipeError,
    });
  }

  if (!recipeEntry) {
    console.warn("Recipe not found or unauthorized for acceptance", {
      userId,
      recipeId,
      command,
    });
    throw new AdaptationServiceError({
      code: "recipe_not_found",
      message: "Recipe not found.",
    });
  }

  const { data: recipeRow, error: updateError } = await supabase
    .from("recipes")
    .update({
      recipe_text: command.recipeText,
      kcal: command.macros.kcal,
      protein: command.macros.protein,
      carbs: command.macros.carbs,
      fat: command.macros.fat,
      last_adaptation_explanation: command.explanation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipeId)
    .eq("user_id", userId)
    .select(
      "id, title, servings, kcal, protein, carbs, fat, recipe_text, last_adaptation_explanation, created_at, updated_at"
    )
    .maybeSingle();

  if (updateError || !recipeRow) {
    console.error("Failed to accept adaptation", {
      userId,
      recipeId,
      command,
      error: updateError,
    });

    throw new AdaptationServiceError({
      code: "accept_failed",
      message: "Unable to accept adaptation.",
      cause: updateError,
    });
  }

  return mapRecipeRowToDTO(recipeRow as RecipeRow);
};

export const getProfilePreferences = async (
  supabase: SupabaseClient,
  userId: string
): Promise<{
  allergens: string[];
  dislikedIngredients: string[];
  timezone: AdaptationQuotaDTO["timezone"];
}> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("allergens, disliked_ingredients, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load user profile for adaptation", {
      userId,
      error,
    });

    throw new AdaptationServiceError({
      code: "quota_fetch_failed",
      message: "Unable to load user profile preferences.",
      cause: error,
    });
  }

  return {
    allergens: data?.allergens ?? [],
    dislikedIngredients: data?.disliked_ingredients ?? [],
    timezone: (data?.timezone ?? "UTC") as AdaptationQuotaDTO["timezone"],
  };
};

const fetchRecipeForAdaptation = async (
  supabase: SupabaseClient,
  userId: string,
  recipeId: string
): Promise<RecipeDTO> => {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch recipe for adaptation", {
      userId,
      recipeId,
      error,
    });

    throw new AdaptationServiceError({
      code: "history_fetch_failed",
      message: "Unable to load recipe for adaptation.",
      cause: error,
    });
  }

  if (!data) {
    throw new AdaptationServiceError({
      code: "recipe_not_found",
      message: "Recipe not found.",
    });
  }

  return mapRecipeRowToDTO(data as RecipeRow);
};

const calculateQuota = async (
  supabase: SupabaseClient,
  userId: string,
  timezone: AdaptationQuotaDTO["timezone"]
): Promise<AdaptationQuotaUsage> => {
  const limit = getDailyAdaptationLimit();
  const now = new Date();
  const window = resolveDailyWindowUtc(now, timezone);

  const { count, error } = await supabase
    .from("adaptation_logs")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", window.start)
    .lt("created_at", window.end);

  if (error) {
    console.error("Failed to compute adaptation quota", {
      userId,
      timezone,
      error,
    });

    throw new AdaptationServiceError({
      code: "quota_fetch_failed",
      message: "Unable to compute adaptation quota usage.",
      cause: error,
    });
  }

  const used = count ?? 0;

  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    windowStart: window.start,
    windowEnd: window.end,
    timezone,
  } satisfies AdaptationQuotaUsage;
};

export const getAdaptationQuota = async (
  supabase: SupabaseClient,
  userId: string
): Promise<AdaptationQuotaResponseDTO> => {
  const profile = await getProfilePreferences(supabase, userId);
  const quota = await calculateQuota(supabase, userId, profile.timezone);

  return {
    data: buildQuotaDto(quota.limit, quota.used, quota.windowStart, quota.windowEnd, quota.timezone),
  } satisfies AdaptationQuotaResponseDTO;
};

const assertQuotaAvailable = (quota: AdaptationQuotaUsage) => {
  if (quota.remaining <= 0) {
    throw new AdaptationServiceError({
      code: "quota_exceeded",
      message: "Daily adaptation quota exceeded.",
    });
  }
};

const insertAdaptationLog = async (supabase: SupabaseClient, userId: string, recipeId: string): Promise<string> => {
  const payload: TablesInsert<"adaptation_logs"> = {
    user_id: userId,
    recipe_id: recipeId,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("adaptation_logs").insert(payload).select("id").single();

  if (error || !data) {
    console.error("Failed to insert adaptation log", {
      userId,
      recipeId,
      error,
    });

    throw new AdaptationServiceError({
      code: "adaptation_log_failed",
      message: "Unable to log adaptation request.",
      cause: error,
    });
  }

  return data.id;
};

const buildProposalDto = (
  proposal: AiAdaptationResponse,
  logId: string,
  command: RecipeAdaptationRequestCommand,
  quota: AdaptationQuotaUsage
): RecipeAdaptationProposalDTO => ({
  logId,
  goal: command.goal,
  proposedRecipe: {
    recipeText: proposal.recipeText,
    macros: proposal.macros,
  },
  explanation: proposal.explanation,
  quota: buildQuotaDto(quota.limit, quota.used + 1, quota.windowStart, quota.windowEnd, quota.timezone),
  requestMetadata: {
    requestedAt: new Date().toISOString(),
    notes: command.notes ?? null,
    disclaimer: ADAPTATION_DISCLAIMER,
  },
});

export const proposeAdaptation = async (
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  command: RecipeAdaptationRequestCommand,
  options?: { idempotencyKey?: string }
): Promise<ProposeAdaptationResult> => {
  ensureIdempotencyKey(options?.idempotencyKey);

  const inFlightKey = buildInFlightKey(userId, recipeId);

  if (inFlightAdaptations.has(inFlightKey)) {
    throw new AdaptationServiceError({
      code: "adaptation_in_progress",
      message: "An adaptation for this recipe is already in progress.",
    });
  }

  const cacheKey = options?.idempotencyKey
    ? buildIdempotencyCacheKey(userId, recipeId, options.idempotencyKey)
    : undefined;

  if (cacheKey) {
    const cachedResult = idempotencyCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  inFlightAdaptations.add(inFlightKey);

  try {
    console.log("Starting adaptation proposal", {
      userId,
      recipeId,
      goal: command.goal,
    });

    const profile = await getProfilePreferences(supabase, userId);
    console.log("Profile loaded", {
      allergenCount: profile.allergens.length,
      dislikedCount: profile.dislikedIngredients.length,
      timezone: profile.timezone,
    });

    const recipe = await fetchRecipeForAdaptation(supabase, userId, recipeId);
    console.log("Recipe loaded", {
      recipeId: recipe.id,
      title: recipe.title,
    });

    const quota = await calculateQuota(supabase, userId, profile.timezone);
    console.log("Quota calculated", {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
    });

    assertQuotaAvailable(quota);

    const logId = await insertAdaptationLog(supabase, userId, recipeId);
    console.log("Adaptation log created", { logId });

    const aiResponse = await generateAiAdaptation({
      recipe,
      profile,
      command,
    });

    console.log("AI adaptation completed successfully");

    const proposalDto = buildProposalDto(aiResponse, logId, command, quota);

    const result: AdaptationProposalResult = {
      status: "completed",
      proposal: proposalDto,
    };

    if (cacheKey) {
      idempotencyCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    if (cacheKey) {
      idempotencyCache.delete(cacheKey);
    }

    if (error instanceof AdaptationServiceError) {
      throw error;
    }

    console.error("Unexpected error during adaptation proposal", {
      userId,
      recipeId,
      error,
    });

    throw new AdaptationServiceError({
      code: "proposal_generation_failed",
      message: "Failed to generate adaptation proposal.",
      cause: error,
    });
  } finally {
    inFlightAdaptations.delete(inFlightKey);
  }
};
