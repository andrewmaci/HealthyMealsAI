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

const DAILY_ADAPTATION_LIMIT_FALLBACK = 3;
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
  timezone: AdaptationQuotaDTO["timezone"],
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

const adaptMacros = (
  goal: RecipeAdaptationRequestCommand["goal"],
  baseMacros: RecipeDTO["macros"],
): RecipeDTO["macros"] => {
  switch (goal) {
    case "reduce_calories":
      return {
        kcal: roundToTwo(baseMacros.kcal * 0.9),
        protein: roundToTwo(baseMacros.protein),
        carbs: roundToTwo(baseMacros.carbs * 0.9),
        fat: roundToTwo(baseMacros.fat * 0.9),
      };
    case "increase_protein":
      return {
        kcal: roundToTwo(baseMacros.kcal * 1.05),
        protein: roundToTwo(baseMacros.protein * 1.2),
        carbs: roundToTwo(baseMacros.carbs),
        fat: roundToTwo(baseMacros.fat),
      };
    default:
      return {
        kcal: roundToTwo(baseMacros.kcal),
        protein: roundToTwo(baseMacros.protein),
        carbs: roundToTwo(baseMacros.carbs),
        fat: roundToTwo(baseMacros.fat),
      };
  }
};

interface MockAiInput {
  recipe: RecipeDTO;
  profile: {
    allergens: string[];
    dislikedIngredients: string[];
    timezone: AdaptationQuotaDTO["timezone"];
  };
  command: RecipeAdaptationRequestCommand;
}

interface MockAiCompletedResponse {
  status: "completed";
  recipeText: string;
  macros: RecipeDTO["macros"];
  explanation: string;
}

type MockAiResponse = MockAiCompletedResponse | { status: "pending" };

const generateMockProposal = async (input: MockAiInput): Promise<MockAiResponse> => {
  const { recipe, command, profile } = input;
  const macros = adaptMacros(command.goal, recipe.macros);

  const allergenText = profile.allergens.length > 0 ? `Avoided allergens: ${profile.allergens.join(", ")}. ` : "";
  const dislikedText =
    profile.dislikedIngredients.length > 0
      ? `Excluded disliked ingredients: ${profile.dislikedIngredients.join(", ")}. `
      : "";
  const notesText = command.notes ? `User notes: ${command.notes}. ` : "";

  const explanation = `Adaptation goal '${command.goal}' applied. ${allergenText}${dislikedText}${notesText}`.trim();

  const recipeText = `# ${recipe.title} (Adapted)\n\n${explanation}\n\n${recipe.recipeText}`;

  return {
    status: "completed",
    recipeText,
    macros,
    explanation,
  } satisfies MockAiCompletedResponse;
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

const applyHistoryFilters = (
  builder: ReturnType<SupabaseClient["from"]>,
  query: GetRecipeAdaptationHistoryQuery,
) => {
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
  query: GetRecipeAdaptationHistoryQuery,
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
    query,
  ).maybeSingle();

  const dataPromise = applyHistoryFilters(
    supabase
      .from("adaptation_logs")
      .select("id, recipe_id, created_at")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId),
    query,
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
  command: RecipeAdaptationAcceptCommand,
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
    .select("id, title, servings, kcal, protein, carbs, fat, recipe_text, last_adaptation_explanation, created_at, updated_at")
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
  userId: string,
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
  recipeId: string,
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
  timezone: AdaptationQuotaDTO["timezone"],
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
  userId: string,
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

const insertAdaptationLog = async (
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
): Promise<string> => {
  const payload: TablesInsert<"adaptation_logs"> = {
    user_id: userId,
    recipe_id: recipeId,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("adaptation_logs")
    .insert(payload)
    .select("id")
    .single();

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
  proposal: MockAiCompletedResponse,
  logId: string,
  command: RecipeAdaptationRequestCommand,
  quota: AdaptationQuotaUsage,
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
  options?: { idempotencyKey?: string },
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

  if (cacheKey && idempotencyCache.has(cacheKey)) {
    return idempotencyCache.get(cacheKey)!;
  }

  inFlightAdaptations.add(inFlightKey);

  try {
    const profile = await getProfilePreferences(supabase, userId);
    const recipe = await fetchRecipeForAdaptation(supabase, userId, recipeId);
    const quota = await calculateQuota(supabase, userId, profile.timezone);

    assertQuotaAvailable(quota);

    const logId = await insertAdaptationLog(supabase, userId, recipeId);

    const aiResponse = await generateMockProposal({
      recipe,
      profile,
      command,
    });

    if (aiResponse.status === "pending") {
      const pendingResult: AdaptationPendingResult = {
        status: "pending",
        response: {
          data: {
            status: "pending",
          },
        },
      };

      if (cacheKey) {
        idempotencyCache.set(cacheKey, pendingResult);
      }

      return pendingResult;
    }

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

