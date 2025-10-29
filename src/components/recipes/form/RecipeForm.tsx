import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { trackRecipeCreated } from "@/lib/analytics";
import { parseApiError, readStandardApiResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  MacroPrecisionErrorMessage,
  RecipeCreateDtoSchema,
  type RecipeCreateDto,
  type RecipeDTO,
  type ProfileDTO,
  type RecipeUpdateDto,
} from "@/types";

import { InlineError } from "./InlineError";

const MACRO_KEYS = ["kcal", "protein", "carbs", "fat"] as const;
const MACRO_LABELS: Record<MacroKey, string> = {
  kcal: "Total calories (kcal)",
  protein: "Protein (g)",
  carbs: "Carbohydrates (g)",
  fat: "Fat (g)",
};

const MAX_RECIPE_TEXT_LENGTH = 10_000;
const MAX_EXPLANATION_LENGTH = 2_000;

type MacroKey = (typeof MACRO_KEYS)[number];

export type RecipeFormValues = {
  title: string;
  servings: string;
  macros: Record<MacroKey, string>;
  recipeText: string;
  lastAdaptationExplanation?: string;
};

type FieldErrorMap = {
  title?: string;
  servings?: string;
  macros?: Partial<Record<MacroKey, string>>;
  recipeText?: string;
  lastAdaptationExplanation?: string;
  form?: string;
};

interface RecipeFormProps {
  mode: "create" | "edit";
  recipeId?: string;
  initialRecipe?: RecipeDTO;
  onSaved?: (recipe: RecipeDTO) => void;
  onCancel?: () => void;
}

const createDefaultValues = (): RecipeFormValues => ({
  title: "",
  servings: "",
  macros: {
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
  },
  recipeText: "",
  lastAdaptationExplanation: "",
});

const mapRecipeToFormValues = (recipe: RecipeDTO): RecipeFormValues => ({
  title: recipe.title ?? "",
  servings: String(recipe.servings ?? ""),
  macros: {
    kcal: recipe.macros?.kcal != null ? String(recipe.macros.kcal) : "",
    protein: recipe.macros?.protein != null ? String(recipe.macros.protein) : "",
    carbs: recipe.macros?.carbs != null ? String(recipe.macros.carbs) : "",
    fat: recipe.macros?.fat != null ? String(recipe.macros.fat) : "",
  },
  recipeText: recipe.recipeText ?? "",
  lastAdaptationExplanation: recipe.lastAdaptationExplanation ?? "",
});

const hasAtMostTwoDecimalPlaces = (value: number): boolean => Number.isInteger(Math.round(value * 100));

interface ValidationResult {
  errors: FieldErrorMap;
  payload?: RecipeCreateDto;
}

const normalizeExplanation = (value: string | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
};

const validateValues = (values: RecipeFormValues): ValidationResult => {
  const errors: FieldErrorMap = {};

  const title = values.title.trim();

  if (title.length === 0) {
    errors.title = "Title is required.";
  } else if (title.length > 200) {
    errors.title = "Title cannot exceed 200 characters.";
  }

  const servingsRaw = values.servings.trim();
  let parsedServings: number | undefined;

  if (servingsRaw.length === 0) {
    errors.servings = "Servings are required.";
  } else {
    const parsed = Number(servingsRaw);

    if (!Number.isInteger(parsed)) {
      errors.servings = "Servings must be a whole number.";
    } else if (parsed < 1) {
      errors.servings = "Servings must be at least 1.";
    } else if (parsed > 50) {
      errors.servings = "Servings cannot exceed 50.";
    } else {
      parsedServings = parsed;
    }
  }

  const macrosErrors: NonNullable<FieldErrorMap["macros"]> = {};
  const parsedMacros: RecipeCreateDto["macros"] = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  MACRO_KEYS.forEach((key) => {
    const raw = values.macros[key]?.trim() ?? "";

    if (raw.length === 0) {
      macrosErrors[key] = `${MACRO_LABELS[key]} is required.`;
      return;
    }

    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) {
      macrosErrors[key] = `${MACRO_LABELS[key]} must be a number.`;
      return;
    }

    if (parsed < 0) {
      macrosErrors[key] = `${MACRO_LABELS[key]} cannot be negative.`;
      return;
    }

    if (!hasAtMostTwoDecimalPlaces(parsed)) {
      macrosErrors[key] = MacroPrecisionErrorMessage;
      return;
    }

    parsedMacros[key] = parsed;
  });

  if (Object.keys(macrosErrors).length > 0) {
    errors.macros = macrosErrors;
  }

  const recipeText = values.recipeText.trim();

  if (recipeText.length === 0) {
    errors.recipeText = "Recipe instructions are required.";
  } else if (recipeText.length > MAX_RECIPE_TEXT_LENGTH) {
    errors.recipeText = `Recipe instructions cannot exceed ${MAX_RECIPE_TEXT_LENGTH.toLocaleString()} characters.`;
  }

  const explanation = normalizeExplanation(values.lastAdaptationExplanation);

  if (typeof explanation === "string" && explanation.length > MAX_EXPLANATION_LENGTH) {
    errors.lastAdaptationExplanation = `Adaptation explanation cannot exceed ${MAX_EXPLANATION_LENGTH.toLocaleString()} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const payload: RecipeCreateDto = {
    title,
    servings: parsedServings!,
    macros: parsedMacros,
    recipeText,
  };

  if (explanation !== undefined) {
    payload.lastAdaptationExplanation = explanation;
  }

  return {
    errors,
    payload,
  };
};

const getDefaultTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("Failed to resolve timezone", error);
    }

    return "UTC";
  }
};

type RecipeValidationErrors = z.inferFlattenedErrors<typeof RecipeCreateDtoSchema>;

interface CharacterCounterProps {
  current: number;
  max: number;
  id: string;
}

const CharacterCounter = ({ current, max, id }: CharacterCounterProps) => {
  const remaining = max - current;
  const isOver = remaining < 0;

  const label = isOver
    ? `${Math.abs(remaining).toLocaleString()} characters over limit`
    : `${remaining.toLocaleString()} characters remaining`;

  return (
    <p
      id={id}
      aria-live="polite"
      className={cn("text-xs", isOver ? "text-destructive" : "text-muted-foreground")}
      role="status"
    >
      {label}
    </p>
  );
};

interface FieldGroupProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
  descriptionId?: string;
  description?: string;
  errorMessage?: string;
  errorId?: string;
  required?: boolean;
}

const FieldGroup = ({
  label,
  htmlFor,
  children,
  description,
  descriptionId,
  errorMessage,
  errorId,
  required,
}: FieldGroupProps) => (
  <div className="flex flex-col gap-2">
    <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
      {label}
      {required ? <span className="ml-1 text-destructive" aria-hidden="true">*</span> : null}
    </label>
    {description ? (
      <p id={descriptionId} className="text-sm text-muted-foreground">
        {description}
      </p>
    ) : null}
    {children}
    <InlineError id={errorId} message={errorMessage} />
  </div>
);

export default function RecipeForm({
  mode,
  recipeId,
  initialRecipe,
  onSaved,
  onCancel,
}: RecipeFormProps) {
  const componentId = useId();

  const [timezone, setTimezone] = useState<string>(() => getDefaultTimezone());
  const [values, setValues] = useState<RecipeFormValues>(() => {
    if (mode === "edit" && initialRecipe) {
      return mapRecipeToFormValues(initialRecipe);
    }

    return createDefaultValues();
  });
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(mode === "edit" && !initialRecipe);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (mode === "edit" && initialRecipe?.lastAdaptationExplanation) {
      return true;
    }

    return false;
  });

  const titleRef = useRef<HTMLInputElement>(null);
  const servingsRef = useRef<HTMLInputElement>(null);
  const kcalRef = useRef<HTMLInputElement>(null);
  const proteinRef = useRef<HTMLInputElement>(null);
  const carbsRef = useRef<HTMLInputElement>(null);
  const fatRef = useRef<HTMLInputElement>(null);
  const macroRefs: Record<MacroKey, RefObject<HTMLInputElement>> = {
    kcal: kcalRef,
    protein: proteinRef,
    carbs: carbsRef,
    fat: fatRef,
  };
  const recipeTextRef = useRef<HTMLTextAreaElement>(null);
  const explanationRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfileTimezone = async () => {
      try {
        const response = await fetch("/api/profile");

        if (!response.ok) {
          return;
        }

        const profile = await readStandardApiResponse<ProfileDTO>(response);

        if (isMounted && profile.timezone) {
          setTimezone(profile.timezone);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug("Unable to fetch profile timezone", error);
        }
      }
    };

    loadProfileTimezone();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }

    if (initialRecipe) {
      setValues(mapRecipeToFormValues(initialRecipe));
      setIsLoadingInitial(false);
      setLoadError(undefined);
    }
  }, [initialRecipe, mode]);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }

    if (initialRecipe || !recipeId) {
      return;
    }

    let isMounted = true;

    const loadRecipe = async () => {
      setIsLoadingInitial(true);
      setLoadError(undefined);

      try {
        const response = await fetch(`/api/recipes/${recipeId}`);

        if (!response.ok) {
          if (response.status === 404) {
            if (isMounted) {
              setLoadError("Recipe not found.");
            }
            return;
          }

          const message = await parseApiError(response);

          if (isMounted) {
            setLoadError(message);
          }

          return;
        }

        const recipe = await readStandardApiResponse<RecipeDTO>(response);

        if (isMounted) {
          setValues(mapRecipeToFormValues(recipe));
          setShowAdvanced(Boolean(recipe.lastAdaptationExplanation));
          setLoadError(undefined);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to load recipe", error);
        }

        if (isMounted) {
          setLoadError("Unable to load recipe. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingInitial(false);
        }
      }
    };

    loadRecipe();

    return () => {
      isMounted = false;
    };
  }, [initialRecipe, mode, recipeId]);

  const ids = useMemo(() => ({
    title: `${componentId}-title`,
    servings: `${componentId}-servings`,
    macros: MACRO_KEYS.reduce<Record<MacroKey, string>>((acc, key) => {
      acc[key] = `${componentId}-macros-${key}`;
      return acc;
    }, {} as Record<MacroKey, string>),
    recipeText: `${componentId}-recipe-text`,
    recipeTextCounter: `${componentId}-recipe-text-counter`,
    explanation: `${componentId}-last-adaptation`,
    formError: `${componentId}-form-error`,
  }), [componentId]);

  const remainingChars = MAX_RECIPE_TEXT_LENGTH - values.recipeText.length;
  const isOverLimit = remainingChars < 0;

  const resetFormErrors = useCallback(() => {
    setErrors((prev) => ({ ...prev, form: undefined }));
    setSubmitError(undefined);
    setSuccessMessage(undefined);
  }, []);

  const clearFieldError = useCallback((field: keyof FieldErrorMap, macroKey?: MacroKey) => {
    setErrors((prev) => {
      let next = prev;
      let changed = false;

      if (field === "macros") {
        if (prev.macros && macroKey && prev.macros[macroKey]) {
          const nextMacros = { ...prev.macros };
          delete nextMacros[macroKey];
          changed = true;

          if (Object.keys(nextMacros).length === 0) {
            const { macros, ...rest } = prev;
            next = rest;
          } else {
            next = {
              ...prev,
              macros: nextMacros,
            };
          }
        }
      } else if (prev[field]) {
        const { [field]: _removed, ...rest } = prev;
        next = rest;
        changed = true;
      }

      if (next.form) {
        const { form: _form, ...rest } = next;
        next = rest;
        changed = true;
      }

      return changed ? next : prev;
    });
    setSubmitError(undefined);
    setSuccessMessage(undefined);
  }, []);

  const focusFirstInvalidField = useCallback(
    (validationErrors: FieldErrorMap) => {
      if (validationErrors.title) {
        titleRef.current?.focus();
        return;
      }

      if (validationErrors.servings) {
        servingsRef.current?.focus();
        return;
      }

      if (validationErrors.macros) {
        if (validationErrors.macros.kcal) {
          macroRefs.kcal.current?.focus();
          return;
        }

        if (validationErrors.macros.protein) {
          macroRefs.protein.current?.focus();
          return;
        }

        if (validationErrors.macros.carbs) {
          macroRefs.carbs.current?.focus();
          return;
        }

        if (validationErrors.macros.fat) {
          macroRefs.fat.current?.focus();
          return;
        }
      }

      if (validationErrors.recipeText) {
        recipeTextRef.current?.focus();
        return;
      }

      if (validationErrors.lastAdaptationExplanation) {
        explanationRef.current?.focus();
      }
    },
    [carbsRef, fatRef, kcalRef, proteinRef],
  );

  const handleBlur = useCallback(() => {
    const result = validateValues(values);
    setErrors(result.errors);
  }, [values]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      resetFormErrors();

      const validationResult = validateValues(values);
      setErrors(validationResult.errors);

      if (!validationResult.payload) {
        focusFirstInvalidField(validationResult.errors);
        return;
      }

      const payload = validationResult.payload;

      setIsSubmitting(true);

      try {
        const targetRecipeId = mode === "create" ? undefined : recipeId ?? initialRecipe?.id;

        if (mode === "edit" && !targetRecipeId) {
          setSubmitError("Recipe identifier is missing.");
          return;
        }

        const url = mode === "create" ? "/api/recipes" : `/api/recipes/${targetRecipeId}?return=full`;

        const requestBody: RecipeCreateDto | RecipeUpdateDto = payload;

        const response = await fetch(url, {
          method: mode === "create" ? "POST" : "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          if (response.status === 400) {
            const data = (await response.json().catch(() => null)) as { details?: RecipeValidationErrors } | null;

            const flattened = data?.details;

            if (flattened) {
              const fieldErrors: FieldErrorMap = {};

              if (Array.isArray(flattened.formErrors) && flattened.formErrors.length > 0) {
                fieldErrors.form = flattened.formErrors.join(" ");
              }

              const macrosFieldErrors: NonNullable<FieldErrorMap["macros"]> = {};

              for (const [field, messages] of Object.entries(flattened.fieldErrors ?? {})) {
                const message = messages?.[0];

                if (!message) {
                  continue;
                }

                if (field.startsWith("macros.")) {
                  const macroField = field.split(".")[1] as MacroKey | undefined;

                  if (macroField && MACRO_KEYS.includes(macroField)) {
                    macrosFieldErrors[macroField] = message;
                    continue;
                  }
                }

                if (field === "title" || field === "servings" || field === "recipeText") {
                  fieldErrors[field] = message;
                  continue;
                }

                if (field === "lastAdaptationExplanation") {
                  fieldErrors.lastAdaptationExplanation = message;
                  continue;
                }
              }

              if (Object.keys(macrosFieldErrors).length > 0) {
                fieldErrors.macros = macrosFieldErrors;
              }

              setErrors(fieldErrors);
              focusFirstInvalidField(fieldErrors);
              return;
            }
          }

          const message = await parseApiError(response);
          setSubmitError(message);
          return;
        }

        const recipe = await readStandardApiResponse<RecipeDTO>(response);

        setErrors({});
        setSuccessMessage(mode === "create" ? "Recipe created successfully." : "Recipe updated successfully.");
        onSaved?.(recipe);

        if (mode === "create") {
          trackRecipeCreated(timezone, { recipeId: recipe.id, title: recipe.title });
        }

        window.location.assign(`/recipes/${recipe.id}`);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to submit recipe form", error);
        }

        setSubmitError("Unexpected error occurred. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [focusFirstInvalidField, initialRecipe?.id, mode, onSaved, parseApiError, readStandardApiResponse, recipeId, resetFormErrors, timezone, values],
  );

  const handleCancel = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (onCancel) {
      onCancel();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("/recipes");
  }, [isSubmitting, onCancel]);

  if (isLoadingInitial) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-muted-foreground">Loading recipe…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center">
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => (window.location.href = "/recipes")}>Return to recipes</Button>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  const submitLabel = mode === "create" ? "Create recipe" : "Save changes";

  return (
    <form className="mx-auto flex w-full max-w-3xl flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <FieldGroup
        label="Title"
        htmlFor={ids.title}
        errorMessage={errors.title}
        errorId={errors.title ? `${ids.title}-error` : undefined}
        required
      >
        <input
          id={ids.title}
          ref={titleRef}
          name="title"
          type="text"
          value={values.title}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValues((current) => ({
              ...current,
              title: nextValue,
            }));
            clearFieldError("title");
          }}
          onBlur={handleBlur}
          maxLength={200}
          aria-invalid={errors.title ? "true" : undefined}
          aria-describedby={errors.title ? `${ids.title}-error` : undefined}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition", 
            errors.title ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-ring",
          )}
        />
      </FieldGroup>

      <FieldGroup
        label="Servings"
        htmlFor={ids.servings}
        errorMessage={errors.servings}
        errorId={errors.servings ? `${ids.servings}-error` : undefined}
        required
      >
        <input
          id={ids.servings}
          ref={servingsRef}
          name="servings"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={values.servings}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValues((current) => ({
              ...current,
              servings: nextValue,
            }));
            clearFieldError("servings");
          }}
          onBlur={handleBlur}
          aria-invalid={errors.servings ? "true" : undefined}
          aria-describedby={errors.servings ? `${ids.servings}-error` : undefined}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition", 
            errors.servings ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-ring",
          )}
        />
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Macros (per serving)</span>
        <div className="grid gap-4 sm:grid-cols-2">
          {MACRO_KEYS.map((key) => {
            const errorMessage = errors.macros?.[key];
            const errorId = errorMessage ? `${ids.macros[key]}-error` : undefined;

            return (
              <div className="flex flex-col gap-2" key={key}>
                <label htmlFor={ids.macros[key]} className="text-sm font-medium text-foreground">
                  {MACRO_LABELS[key]}
                </label>
                <input
                  id={ids.macros[key]}
                  ref={macroRefs[key]}
                  name={`macro-${key}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={values.macros[key]}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setValues((current) => ({
                      ...current,
                      macros: {
                        ...current.macros,
                        [key]: nextValue,
                      },
                    }));
                    clearFieldError("macros", key);
                  }}
                  onBlur={handleBlur}
                  aria-invalid={errorMessage ? "true" : undefined}
                  aria-describedby={errorId}
                  className={cn(
                    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition", 
                    errorMessage ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-ring",
                  )}
                />
                <InlineError id={errorId} message={errorMessage} />
              </div>
            );
          })}
        </div>
      </div>

      <FieldGroup
        label="Recipe instructions"
        htmlFor={ids.recipeText}
        errorMessage={errors.recipeText}
        errorId={errors.recipeText ? `${ids.recipeText}-error` : undefined}
        required
      >
        <textarea
          id={ids.recipeText}
          ref={recipeTextRef}
          name="recipeText"
          value={values.recipeText}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValues((current) => ({
              ...current,
              recipeText: nextValue,
            }));
            clearFieldError("recipeText");
          }}
          onBlur={handleBlur}
          aria-invalid={errors.recipeText ? "true" : undefined}
          aria-describedby={cn(errors.recipeText ? `${ids.recipeText}-error` : undefined, ids.recipeTextCounter)}
          maxLength={MAX_RECIPE_TEXT_LENGTH}
          rows={10}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition", 
            errors.recipeText ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-ring",
          )}
        />
        <CharacterCounter current={values.recipeText.length} max={MAX_RECIPE_TEXT_LENGTH} id={ids.recipeTextCounter} />
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            resetFormErrors();
            setShowAdvanced((prev) => !prev);
          }}
          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
          aria-expanded={showAdvanced}
          aria-controls={showAdvanced ? ids.explanation : undefined}
        >
          {showAdvanced ? "Hide advanced fields" : "Show adaptation explanation"}
        </button>

        {showAdvanced ? (
          <FieldGroup
            label="Last adaptation explanation"
            htmlFor={ids.explanation}
            errorMessage={errors.lastAdaptationExplanation}
            errorId={errors.lastAdaptationExplanation ? `${ids.explanation}-error` : undefined}
            description="Optional notes that describe the last adaptation."
            descriptionId={`${ids.explanation}-description`}
          >
            <textarea
              id={ids.explanation}
              ref={explanationRef}
              name="lastAdaptationExplanation"
              value={values.lastAdaptationExplanation ?? ""}
              onChange={(event) => {
                const nextValue = event.target.value;
                setValues((current) => ({
                  ...current,
                  lastAdaptationExplanation: nextValue,
                }));
                clearFieldError("lastAdaptationExplanation");
              }}
              onBlur={handleBlur}
              aria-invalid={errors.lastAdaptationExplanation ? "true" : undefined}
              aria-describedby={cn(
                errors.lastAdaptationExplanation ? `${ids.explanation}-error` : undefined,
                `${ids.explanation}-description`,
              )}
              maxLength={MAX_EXPLANATION_LENGTH}
              rows={5}
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition", 
                errors.lastAdaptationExplanation ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-ring",
              )}
            />
          </FieldGroup>
        ) : null}
      </div>

      {(errors.form || submitError || successMessage) && (
        <div className="space-y-2">
          {errors.form ? (
            <p id={ids.formError} role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          ) : null}
          {submitError ? (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          ) : null}
          {successMessage ? (
            <p role="status" className="text-sm text-emerald-600">
              {successMessage}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isSubmitting || isOverLimit} aria-disabled={isSubmitting || isOverLimit}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        {isOverLimit ? (
          <p role="alert" className="text-sm text-destructive">
            Recipe instructions exceed the character limit. Please shorten the text before submitting.
          </p>
        ) : null}
      </div>
    </form>
  );
}

