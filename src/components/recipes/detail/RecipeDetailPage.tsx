import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRecipeDetail } from "@/components/hooks/useRecipeDetail";
import { useQuota } from "@/components/hooks/useQuota";
import { trackAiAccepted, trackAiRequested, trackAiSucceeded } from "@/lib/analytics";
import type { RecipeDTO } from "@/types";

import AdaptationToolbar from "./AdaptationToolbar";
import AdaptationWizard from "./AdaptationWizard";
import HeaderBar from "./HeaderBar";
import NotificationBox from "./NotificationBox";
import RecipeDisplay from "./RecipeDisplay";
import ToastArea from "./ToastArea";

interface RecipeDetailPageProps {
  id: string;
}

type ToastKind = "info" | "success" | "error";

interface ToastMessage {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

const createToastId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
};

const RecipeDetailPage = ({ id }: RecipeDetailPageProps) => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const {
    recipe,
    loading: recipeLoading,
    error: recipeError,
    notFound,
    refresh: refreshRecipe,
    setRecipe,
    deleteRecipe,
  } = useRecipeDetail(id);
  const { quota, loading: quotaLoading, error: quotaError, refresh: refreshQuota } = useQuota();

  const timezone = quota?.timezone ?? "UTC";

  const lastRecipeErrorRef = useRef<string | null>(null);
  const lastQuotaErrorRef = useRef<string | null>(null);

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    setToasts((current) => [...current, { ...toast, id: createToastId() }]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  useEffect(() => {
    if (recipeError && recipeError !== lastRecipeErrorRef.current) {
      lastRecipeErrorRef.current = recipeError;
      pushToast({
        kind: "error",
        title: "Failed to load recipe",
        description: recipeError,
      });
    } else if (!recipeError) {
      lastRecipeErrorRef.current = null;
    }
  }, [pushToast, recipeError]);

  useEffect(() => {
    if (quotaError && quotaError !== lastQuotaErrorRef.current) {
      lastQuotaErrorRef.current = quotaError;
      pushToast({
        kind: "error",
        title: "Failed to load adaptation quota",
        description: quotaError,
      });
    } else if (!quotaError) {
      lastQuotaErrorRef.current = null;
    }
  }, [pushToast, quotaError]);

  const handleRetry = useCallback(() => {
    void Promise.all([refreshRecipe(), refreshQuota()]);
  }, [refreshQuota, refreshRecipe]);

  const handleDelete = useCallback(async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteRecipe();

      if (result === "not-found") {
        pushToast({
          kind: "info",
          title: "Recipe already removed",
          description: "The recipe was not found. Returning to the list.",
        });
      } else {
        pushToast({
          kind: "success",
          title: "Recipe deleted",
          description: "Redirecting to recipe list...",
        });
      }

      window.setTimeout(() => {
        window.location.href = "/recipes";
      }, 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete the recipe.";

      pushToast({
        kind: "error",
        title: "Could not delete recipe",
        description: message,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteRecipe, isDeleting, pushToast]);

  const handleWizardOpen = useCallback(() => {
    setIsWizardOpen(true);
  }, []);

  const handleWizardClose = useCallback(() => {
    setIsWizardOpen(false);
  }, []);

  const handleRecipeUpdated = useCallback(
    (updatedRecipe: RecipeDTO) => {
      setRecipe(updatedRecipe);
      setIsWizardOpen(false);
      trackAiAccepted(timezone);
      pushToast({
        kind: "success",
        title: "Adaptation applied",
        description: "The recipe has been updated with the new changes.",
      });
      void refreshQuota();
    },
    [pushToast, refreshQuota, setRecipe, timezone]
  );

  const handleAdaptationRequestStarted = useCallback(() => {
    trackAiRequested(timezone);
    pushToast({
      kind: "info",
      title: "Submitting adaptation request",
      description: "Hold tight while we process your request.",
    });
  }, [pushToast, timezone]);

  const handleAdaptationRequestFailed = useCallback(
    (message: string) => {
      pushToast({
        kind: "error",
        title: "Adaptation failed",
        description: message,
      });
    },
    [pushToast]
  );

  const handleAdaptationReady = useCallback(() => {
    trackAiSucceeded(timezone);
    pushToast({
      kind: "success",
      title: "Adaptation ready",
      description: "Review the proposed changes to your recipe.",
    });
    void refreshQuota();
  }, [pushToast, refreshQuota, timezone]);

  const isInitialLoading = recipeLoading && !recipe && !recipeError && !notFound;

  const pageContent = useMemo(() => {
    if (isInitialLoading) {
      return (
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="text-sm text-muted-foreground">Loading recipe...</div>
        </div>
      );
    }

    if (notFound) {
      return (
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 p-10 text-center">
          <div className="text-2xl font-semibold">Recipe not found</div>
          <p className="max-w-md text-sm text-muted-foreground">
            The requested recipe could not be located. It may have been deleted or you might not have access to it.
          </p>
          <button
            type="button"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            onClick={() => {
              window.location.href = "/recipes";
            }}
          >
            Back to recipes
          </button>
        </div>
      );
    }

    if (recipeError) {
      return (
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-xl border border-destructive/40 bg-destructive/10 p-10 text-center">
          <div className="text-2xl font-semibold text-destructive">Something went wrong</div>
          <p className="max-w-md text-sm text-muted-foreground">{recipeError}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              onClick={handleRetry}
            >
              Retry
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => {
                window.location.href = "/recipes";
              }}
            >
              Back to recipes
            </button>
          </div>
        </div>
      );
    }

    if (!recipe) {
      return null;
    }

    return (
      <div className="flex flex-col gap-6">
        <NotificationBox
          explanation={recipe.lastAdaptationExplanation ?? null}
          timezone={timezone}
          quotaError={quotaError}
        />
        <RecipeDisplay recipe={recipe} />
        <AdaptationToolbar
          quota={quota}
          quotaError={quotaError}
          onOpenWizard={handleWizardOpen}
          isLoading={quotaLoading || recipeLoading}
        />
      </div>
    );
  }, [
    handleRetry,
    handleWizardOpen,
    isInitialLoading,
    notFound,
    quota,
    quotaError,
    quotaLoading,
    recipe,
    recipeError,
    recipeLoading,
    timezone,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <HeaderBar
        title={recipe?.title ?? "Recipe"}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        isLoading={recipeLoading}
        onRetry={handleRetry}
      />
      {pageContent}
      <AdaptationWizard
        open={isWizardOpen}
        onClose={handleWizardClose}
        recipe={recipe}
        quota={quota}
        timezone={timezone}
        onRecipeUpdated={handleRecipeUpdated}
        onRequestStarted={handleAdaptationRequestStarted}
        onRequestFailed={handleAdaptationRequestFailed}
        onRequestSucceeded={handleAdaptationReady}
      />
      <ToastArea toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default RecipeDetailPage;
