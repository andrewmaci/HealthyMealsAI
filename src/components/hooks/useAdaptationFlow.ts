import { useCallback, useMemo, useReducer } from "react";

import { parseApiError, readStandardApiResponse } from "@/lib/api";
import {
  MacroPrecisionErrorMessage,
  RecipeAdaptationAcceptDtoSchema,
  RecipeAdaptationRequestDtoSchema,
  type AdaptationGoal,
  type RecipeAdaptationProposalDTO,
  type RecipeDTO,
  type RecipeMacroDTO,
} from "@/types";

export type MacroField = keyof RecipeMacroDTO;

interface MacroInputState {
  value: string;
  error: string | null;
}

export type MacroInputsState = Record<MacroField, MacroInputState>;

export type AdaptationFlowStep = "closed" | "select" | "submitting" | "pending" | "proposal" | "accepting" | "error";

interface AdaptationFlowState {
  step: AdaptationFlowStep;
  selectedGoal: AdaptationGoal | null;
  notes: string;
  notesError: string | null;
  idempotencyKey: string | null;
  requestError: string | null;
  proposal: RecipeAdaptationProposalDTO | null;
  macroInputs: MacroInputsState | null;
  explanation: string;
}

type AdaptationFlowAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SET_GOAL"; goal: AdaptationGoal | null }
  | { type: "SET_NOTES"; notes: string }
  | { type: "SET_NOTES_ERROR"; message: string | null }
  | { type: "SET_SUBMITTING"; key: string }
  | { type: "SET_PENDING"; key: string }
  | { type: "SET_PROPOSAL"; proposal: RecipeAdaptationProposalDTO }
  | { type: "SET_REQUEST_ERROR"; message: string | null }
  | { type: "SET_STEP"; step: AdaptationFlowStep }
  | { type: "RESET_TO_SELECT" }
  | { type: "RESET_PROPOSAL" }
  | { type: "SET_MACRO_INPUT"; field: MacroField; value: string; error: string | null };

const NOTES_LIMIT = 500;

const MACRO_FIELDS: MacroField[] = ["kcal", "protein", "carbs", "fat"];

const INITIAL_STATE: AdaptationFlowState = {
  step: "closed",
  selectedGoal: null,
  notes: "",
  notesError: null,
  idempotencyKey: null,
  requestError: null,
  proposal: null,
  macroInputs: null,
  explanation: "",
};

const reducer = (state: AdaptationFlowState, action: AdaptationFlowAction): AdaptationFlowState => {
  switch (action.type) {
    case "OPEN":
      return {
        ...INITIAL_STATE,
        step: "select",
      };
    case "CLOSE":
      return { ...INITIAL_STATE };
    case "SET_GOAL":
      return {
        ...state,
        selectedGoal: action.goal,
      };
    case "SET_NOTES":
      return {
        ...state,
        notes: action.notes,
      };
    case "SET_NOTES_ERROR":
      return {
        ...state,
        notesError: action.message,
      };
    case "SET_SUBMITTING":
      return {
        ...state,
        step: "submitting",
        requestError: null,
        idempotencyKey: action.key,
      };
    case "SET_PENDING":
      return {
        ...state,
        step: "pending",
        requestError: null,
        idempotencyKey: action.key,
      };
    case "SET_PROPOSAL":
      return {
        ...state,
        step: "proposal",
        proposal: action.proposal,
        requestError: null,
        macroInputs: createMacroInputs(action.proposal.proposedRecipe.macros),
        explanation: action.proposal.explanation,
      };
    case "SET_REQUEST_ERROR":
      return {
        ...state,
        requestError: action.message,
      };
    case "SET_STEP":
      return {
        ...state,
        step: action.step,
      };
    case "RESET_TO_SELECT":
      return {
        ...state,
        step: "select",
        proposal: null,
        macroInputs: null,
        explanation: "",
        requestError: null,
      };
    case "RESET_PROPOSAL":
      return {
        ...state,
        proposal: null,
        macroInputs: null,
        explanation: "",
      };
    case "SET_MACRO_INPUT":
      if (!state.macroInputs) {
        return state;
      }

      return {
        ...state,
        macroInputs: {
          ...state.macroInputs,
          [action.field]: {
            value: action.value,
            error: action.error,
          },
        },
      };
    default:
      return state;
  }
};

const createMacroInputs = (macros: RecipeMacroDTO): MacroInputsState => {
  return MACRO_FIELDS.reduce<MacroInputsState>((accumulator, field) => {
    accumulator[field] = {
      value: formatMacroValue(macros[field]),
      error: null,
    };
    return accumulator;
  }, {} as MacroInputsState);
};

const formatMacroValue = (value: number) => {
  return Number.isFinite(value) ? String(value) : "0";
};

interface UseAdaptationFlowOptions {
  recipeId: string | null;
  recipe: RecipeDTO | null;
  onRequestStarted?: () => void;
  onRequestFailed?: (message: string) => void;
  onRequestSucceeded?: () => void;
  onAccepted?: (updated: RecipeDTO) => void;
}

interface AdaptationFlowApi {
  state: AdaptationFlowState;
  notesLimit: number;
  notesCount: number;
  open: () => void;
  close: () => void;
  selectGoal: (goal: AdaptationGoal) => void;
  updateNotes: (notes: string) => void;
  submit: () => Promise<void>;
  retry: () => Promise<void>;
  backToSelect: () => void;
  updateMacro: (field: MacroField, nextValue: string) => void;
  resetMacros: () => void;
  accept: () => Promise<void>;
}

const validateMacroString = (value: string): string | null => {
  if (value.trim().length === 0) {
    return "Macro value is required.";
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "Enter a valid number.";
  }

  if (parsed < 0) {
    return "Macro value cannot be negative.";
  }

  if (!Number.isInteger(Math.round(parsed * 100))) {
    return MacroPrecisionErrorMessage;
  }

  return null;
};

const macroInputsToDto = (macroInputs: MacroInputsState): RecipeMacroDTO => {
  return MACRO_FIELDS.reduce<RecipeMacroDTO>((accumulator, field) => {
    accumulator[field] = Number(macroInputs[field].value);
    return accumulator;
  }, {} as RecipeMacroDTO);
};

export const useAdaptationFlow = ({
  recipeId,
  recipe,
  onRequestStarted,
  onRequestFailed,
  onRequestSucceeded,
  onAccepted,
}: UseAdaptationFlowOptions): AdaptationFlowApi => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const notesCount = state.notes.length;

  const open = useCallback(() => {
    if (!recipeId || !recipe) {
      return;
    }

    dispatch({ type: "OPEN" });
  }, [recipe, recipeId]);

  const close = useCallback(() => {
    dispatch({ type: "CLOSE" });
  }, []);

  const selectGoal = useCallback((goal: AdaptationGoal) => {
    dispatch({ type: "SET_GOAL", goal });
  }, []);

  const updateNotes = useCallback((notes: string) => {
    if (notes.length <= NOTES_LIMIT) {
      dispatch({ type: "SET_NOTES", notes });
      dispatch({ type: "SET_NOTES_ERROR", message: null });
    }
  }, []);

  const runSubmission = useCallback(async () => {
    if (!recipeId) {
      return;
    }

    const trimmedNotes = state.notes.trim();
    const submission = {
      goal: state.selectedGoal,
      notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
    };

    const validationResult = RecipeAdaptationRequestDtoSchema.safeParse(submission);

    if (!validationResult.success) {
      const issues = validationResult.error.issues;
      const notesIssue = issues.find((issue) => issue.path[0] === "notes");

      if (!state.selectedGoal) {
        dispatch({ type: "SET_REQUEST_ERROR", message: "Choose a goal to continue." });
      }

      if (notesIssue) {
        dispatch({ type: "SET_NOTES_ERROR", message: notesIssue.message });
      }

      return;
    }

    const key =
      state.idempotencyKey ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);

    dispatch({ type: "SET_SUBMITTING", key });
    onRequestStarted?.();

    try {
      const response = await fetch(`/api/recipes/${encodeURIComponent(recipeId)}/adaptations`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(validationResult.data),
      });

      if (response.status === 202) {
        dispatch({ type: "SET_PENDING", key });
        return;
      }

      if (!response.ok) {
        const message = await parseApiError(response);
        dispatch({ type: "SET_STEP", step: "error" });
        dispatch({ type: "SET_REQUEST_ERROR", message });
        onRequestFailed?.(message);
        return;
      }

      const proposal = await readStandardApiResponse<RecipeAdaptationProposalDTO>(response);
      dispatch({ type: "SET_PROPOSAL", proposal });
      onRequestSucceeded?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit adaptation request.";
      dispatch({ type: "SET_STEP", step: "error" });
      dispatch({ type: "SET_REQUEST_ERROR", message });
      onRequestFailed?.(message);
    }
  }, [
    onRequestFailed,
    onRequestStarted,
    onRequestSucceeded,
    recipeId,
    state.idempotencyKey,
    state.notes,
    state.selectedGoal,
  ]);

  const submit = useCallback(async () => {
    if (state.step === "submitting" || state.step === "accepting") {
      return;
    }

    await runSubmission();
  }, [runSubmission, state.step]);

  const retry = useCallback(async () => {
    if (state.step !== "pending" && state.step !== "error" && state.step !== "select") {
      return;
    }

    await runSubmission();
  }, [runSubmission, state.step]);

  const backToSelect = useCallback(() => {
    dispatch({ type: "RESET_TO_SELECT" });
  }, []);

  const resetMacros = useCallback(() => {
    if (!state.proposal) {
      return;
    }

    dispatch({ type: "SET_PROPOSAL", proposal: state.proposal });
  }, [state.proposal]);

  const updateMacro = useCallback(
    (field: MacroField, nextValue: string) => {
      if (!state.macroInputs) {
        return;
      }

      const error = validateMacroString(nextValue);
      dispatch({ type: "SET_MACRO_INPUT", field, value: nextValue, error });
    },
    [state.macroInputs]
  );

  const accept = useCallback(async () => {
    if (state.step !== "proposal" || !recipeId || !state.proposal || !state.macroInputs) {
      return;
    }

    const macroInputs = state.macroInputs;
    const macroErrors = MACRO_FIELDS.map((field) => ({
      field,
      error: validateMacroString(macroInputs[field].value),
    })).filter((entry) => entry.error !== null);

    if (macroErrors.length > 0) {
      macroErrors.forEach((entry) => {
        dispatch({
          type: "SET_MACRO_INPUT",
          field: entry.field,
          value: macroInputs[entry.field].value,
          error: entry.error,
        });
      });
      return;
    }

    const payload = {
      logId: state.proposal.logId,
      recipeText: state.proposal.proposedRecipe.recipeText,
      macros: macroInputsToDto(macroInputs),
      explanation: state.explanation,
    };

    const validation = RecipeAdaptationAcceptDtoSchema.safeParse(payload);

    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? "Invalid adaptation payload.";
      dispatch({ type: "SET_REQUEST_ERROR", message });
      return;
    }

    dispatch({ type: "SET_STEP", step: "accepting" });

    try {
      const response = await fetch(`/api/recipes/${encodeURIComponent(recipeId)}/adaptations/accept`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      if (!response.ok) {
        const message = await parseApiError(response);
        dispatch({ type: "SET_STEP", step: "proposal" });
        dispatch({ type: "SET_REQUEST_ERROR", message });
        onRequestFailed?.(message);
        return;
      }

      const updatedRecipe = await readStandardApiResponse<RecipeDTO>(response);
      onAccepted?.(updatedRecipe);
      dispatch({ type: "CLOSE" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept adaptation.";
      dispatch({ type: "SET_STEP", step: "proposal" });
      dispatch({ type: "SET_REQUEST_ERROR", message });
      onRequestFailed?.(message);
    }
  }, [onAccepted, onRequestFailed, recipeId, state.explanation, state.macroInputs, state.proposal, state.step]);

  const api = useMemo<AdaptationFlowApi>(
    () => ({
      state,
      notesLimit: NOTES_LIMIT,
      notesCount,
      open,
      close,
      selectGoal,
      updateNotes,
      submit,
      retry,
      backToSelect,
      updateMacro,
      resetMacros,
      accept,
    }),
    [
      accept,
      backToSelect,
      close,
      notesCount,
      open,
      resetMacros,
      retry,
      selectGoal,
      state,
      submit,
      updateMacro,
      updateNotes,
    ]
  );

  return api;
};
