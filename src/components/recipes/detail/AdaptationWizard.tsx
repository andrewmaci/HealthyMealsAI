import { useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useAdaptationFlow, type MacroField, type MacroInputsState } from "@/components/hooks/useAdaptationFlow";
import { cn } from "@/lib/utils";
import type { AdaptationGoal, AdaptationQuotaDTO, RecipeAdaptationProposalDTO, RecipeDTO } from "@/types";

interface AdaptationWizardProps {
  open: boolean;
  onClose: () => void;
  recipe: RecipeDTO | null;
  quota: AdaptationQuotaDTO | null;
  timezone: string;
  onRecipeUpdated: (recipe: RecipeDTO) => void;
  onRequestStarted: () => void;
  onRequestFailed: (message: string) => void;
  onRequestSucceeded: () => void;
}

interface StepSelectGoalProps {
  selectedGoal: AdaptationGoal | null;
  notes: string;
  notesCount: number;
  notesLimit: number;
  notesError: string | null;
  onSelectGoal: (goal: AdaptationGoal) => void;
  onChangeNotes: (value: string) => void;
}

interface MacroEditorProps {
  macroInputs: MacroInputsState | null;
  onChange: (field: MacroField, value: string) => void;
  onReset: () => void;
}

interface StepPendingProps {
  onRetry: () => void;
  onCancel: () => void;
}

interface StepErrorProps {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}

const GOAL_OPTIONS: { value: AdaptationGoal; label: string; description: string }[] = [
  {
    value: "remove_allergens",
    label: "Remove allergens",
    description: "Eliminate ingredients that might trigger known allergies.",
  },
  {
    value: "remove_disliked_ingredients",
    label: "Remove disliked ingredients",
    description: "Swap or remove ingredients you prefer to avoid.",
  },
  {
    value: "reduce_calories",
    label: "Reduce calories",
    description: "Focus on lighter substitutions to lower overall calories.",
  },
  {
    value: "increase_protein",
    label: "Increase protein",
    description: "Boost protein content while maintaining balance.",
  },
];

const MACRO_LABELS: Record<string, string> = {
  kcal: "Calories",
  protein: "Protein (g)",
  carbs: "Carbs (g)",
  fat: "Fat (g)",
};

const AdaptationWizard = ({
  open,
  onClose,
  recipe,
  quota,
  timezone,
  onRecipeUpdated,
  onRequestStarted,
  onRequestFailed,
  onRequestSucceeded,
}: AdaptationWizardProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const flow = useAdaptationFlow({
    recipeId: recipe?.id ?? null,
    recipe,
    onRequestStarted,
    onRequestFailed,
    onRequestSucceeded,
    onAccepted: onRecipeUpdated,
  });

  const {
    state,
    notesLimit,
    notesCount,
    open: openFlow,
    close: closeFlow,
    selectGoal,
    updateNotes,
    submit,
    retry,
    backToSelect,
    updateMacro,
    resetMacros,
    accept,
  } = flow;

  useEffect(() => {
    if (open && recipe) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      openFlow();
      const timer = window.setTimeout(() => {
        dialogRef.current?.focus();
      }, 10);

      return () => {
        window.clearTimeout(timer);
      };
    }

    return undefined;
  }, [open, openFlow, recipe]);

  useEffect(() => {
    if (!open) {
      closeFlow();
      const previouslyFocused = previousActiveElementRef.current;

      if (previouslyFocused) {
        previouslyFocused.focus();
      }

      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [closeFlow, open]);

  const handleClose = useCallback(() => {
    if (state.step === "submitting" || state.step === "accepting") {
      return;
    }

    closeFlow();
    onClose();
  }, [closeFlow, onClose, state.step]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, open]);

  if (!open || !recipe) {
    return null;
  }

  const quotaSummary = quota ? `${quota.remaining} of ${quota.limit} remaining` : "Quota unknown";

  const hasMacroErrors = Boolean(
    state.macroInputs &&
      Object.values(state.macroInputs).some((macro) => macro.error !== null || macro.value.trim().length === 0)
  );

  const isSubmitting = state.step === "submitting";
  const isAccepting = state.step === "accepting";

  const footerButtons = (() => {
    switch (state.step) {
      case "select":
        return [
          {
            label: "Cancel",
            variant: "outline" as const,
            onClick: handleClose,
            disabled: isSubmitting,
          },
          {
            label: "Submit request",
            onClick: submit,
            disabled: !state.selectedGoal || notesCount > notesLimit || isSubmitting,
          },
        ];
      case "pending":
        return [
          {
            label: "Close",
            variant: "outline" as const,
            onClick: handleClose,
          },
          {
            label: "Retry",
            onClick: retry,
          },
        ];
      case "proposal":
        return [
          {
            label: "Back",
            variant: "outline" as const,
            onClick: backToSelect,
          },
          {
            label: "Apply adaptation",
            onClick: accept,
            disabled: hasMacroErrors || isAccepting,
          },
        ];
      case "error":
        return [
          {
            label: "Close",
            variant: "outline" as const,
            onClick: handleClose,
          },
          {
            label: "Try again",
            onClick: retry,
          },
        ];
      case "submitting":
      case "accepting":
        return [
          {
            label: "Close",
            variant: "outline" as const,
            onClick: handleClose,
            disabled: true,
          },
        ];
      default:
        return [
          {
            label: "Close",
            variant: "outline" as const,
            onClick: handleClose,
          },
        ];
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adaptation-wizard-title"
        tabIndex={-1}
        className="relative flex w-full max-w-3xl flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-2xl"
      >
        <header className="flex flex-col gap-1 border-b border-border/60 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="adaptation-wizard-title" className="text-2xl font-semibold text-foreground">
                Adapt recipe with AI
              </h2>
              <p className="text-sm text-muted-foreground">
                Guide the assistant with a goal and optional notes. Review the proposed changes before applying.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {quotaSummary}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Responses consider your timezone ({timezone}).</p>
        </header>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {state.step === "select" ? (
            <StepSelectGoal
              selectedGoal={state.selectedGoal}
              notes={state.notes}
              notesCount={notesCount}
              notesLimit={notesLimit}
              notesError={state.notesError}
              onSelectGoal={selectGoal}
              onChangeNotes={updateNotes}
            />
          ) : null}

          {state.step === "submitting" ? <StepLoading message="Submitting your request..." /> : null}

          {state.step === "pending" ? <StepPending onRetry={retry} onCancel={handleClose} /> : null}

          {state.step === "proposal" && state.proposal ? (
            <StepProposalReview
              proposal={state.proposal}
              recipe={recipe}
              macroInputs={state.macroInputs}
              onChangeMacro={updateMacro}
              onResetMacros={resetMacros}
              hasMacroErrors={hasMacroErrors}
            />
          ) : null}

          {state.step === "accepting" ? <StepLoading message="Applying adaptation..." /> : null}

          {state.step === "error" && state.requestError ? (
            <StepError message={state.requestError} onRetry={retry} onClose={handleClose} />
          ) : null}
        </div>

        {state.requestError && state.step === "proposal" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.requestError}
          </div>
        ) : null}

        <footer className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
          {footerButtons.map((button) => (
            <Button key={button.label} variant={button.variant} onClick={button.onClick} disabled={button.disabled}>
              {button.label}
            </Button>
          ))}
        </footer>
      </div>
    </div>
  );
};

const StepSelectGoal = ({
  selectedGoal,
  notes,
  notesCount,
  notesLimit,
  notesError,
  onSelectGoal,
  onChangeNotes,
}: StepSelectGoalProps) => {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Choose your goal</h3>
        <p className="text-sm text-muted-foreground">
          Pick one goal for the adaptation and optionally provide context.
        </p>
      </div>

      <div className="space-y-3">
        {GOAL_OPTIONS.map((option) => {
          const isSelected = selectedGoal === option.value;

          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-lg border border-border px-4 py-3 shadow-sm transition",
                isSelected ? "border-primary bg-primary/5" : "hover:border-primary/80"
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="adaptation-goal"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onSelectGoal(option.value)}
                  className="h-4 w-4 border border-border"
                />
                <span className="text-sm font-medium text-foreground">{option.label}</span>
              </div>
              <p className="pl-7 text-xs text-muted-foreground">{option.description}</p>
            </label>
          );
        })}
      </div>

      <div className="space-y-2">
        <label htmlFor="adaptation-notes" className="text-sm font-medium text-foreground">
          Notes <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="adaptation-notes"
          value={notes}
          onChange={(event) => onChangeNotes(event.target.value)}
          maxLength={notesLimit}
          rows={4}
          className={cn(
            "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/60",
            notesError ? "border-destructive focus:ring-destructive/40" : undefined
          )}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {notesCount}/{notesLimit}
          </span>
          {notesError ? <span className="text-destructive">{notesError}</span> : null}
        </div>
      </div>
    </section>
  );
};

const StepLoading = ({ message }: { message: string }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="size-10 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
};

const StepPending = ({ onRetry, onCancel }: StepPendingProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="size-10 animate-pulse rounded-full border-2 border-dashed border-primary" aria-hidden="true" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Still working on it...</h3>
        <p className="text-sm text-muted-foreground">
          The adaptation is taking longer than usual. You can retry now or come back later.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
};

const StepProposalReview = ({
  proposal,
  recipe,
  macroInputs,
  onChangeMacro,
  onResetMacros,
  hasMacroErrors,
}: {
  proposal: RecipeAdaptationProposalDTO;
  recipe: RecipeDTO;
  macroInputs: MacroInputsState | null;
  onChangeMacro: (field: MacroField, value: string) => void;
  onResetMacros: () => void;
  hasMacroErrors: boolean;
}) => {
  const recipeLength = proposal.proposedRecipe.recipeText.length;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Review the proposed adaptation</h3>
        <p className="text-sm text-muted-foreground">
          Inspect the suggested changes and adjust macro targets if needed before applying.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <h4 className="text-sm font-semibold text-foreground">AI summary</h4>
        <p className="mt-2 text-sm text-muted-foreground">{proposal.explanation}</p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Proposed macros</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(proposal.proposedRecipe.macros).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {MACRO_LABELS[key]}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <MacroEditor macroInputs={macroInputs} onChange={onChangeMacro} onReset={onResetMacros} />

      {hasMacroErrors ? (
        <p className="text-xs text-destructive">Resolve all macro input errors before applying the adaptation.</p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Proposed recipe text</h4>
          <span className="text-xs text-muted-foreground">{recipeLength}/10000</span>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-background/40 p-4 text-sm leading-relaxed text-foreground">
          {proposal.proposedRecipe.recipeText}
        </div>
      </div>

      <details className="rounded-lg border border-border bg-muted/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Original recipe</summary>
        <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
          {recipe.recipeText}
        </div>
      </details>

      <SafetyDisclaimer />
    </section>
  );
};

const MacroEditor = ({ macroInputs, onChange, onReset }: MacroEditorProps) => {
  if (!macroInputs) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Adjust macros (optional)</h4>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(macroInputs).map(([key, field]) => (
          <div key={key} className="space-y-1">
            <label
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              htmlFor={`macro-${key}`}
            >
              {MACRO_LABELS[key]}
            </label>
            <input
              id={`macro-${key}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={field.value}
              onChange={(event) => onChange(key as MacroField, event.target.value)}
              className={cn(
                "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/60",
                field.error ? "border-destructive focus:ring-destructive/40" : undefined
              )}
            />
            {field.error ? <p className="text-xs text-destructive">{field.error}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
};

const SafetyDisclaimer = () => {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
      AI-generated suggestions do not replace professional medical or nutritional advice. Please validate ingredients
      and quantities against your dietary needs.
    </div>
  );
};

const StepError = ({ message, onRetry, onClose }: StepErrorProps) => {
  return (
    <div className="space-y-4 text-center">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-destructive">We couldn&apos;t complete the request</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
};

export default AdaptationWizard;
