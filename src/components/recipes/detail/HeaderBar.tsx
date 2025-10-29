import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

interface HeaderBarProps {
  title: string;
  onDelete: () => Promise<void>;
  onRetry?: () => void;
  isDeleting?: boolean;
  isLoading?: boolean;
}

const HeaderBar = ({ title, onDelete, onRetry, isDeleting = false, isLoading = false }: HeaderBarProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  const handleOpenConfirm = useCallback(() => {
    if (isDeleting || isLoading) {
      return;
    }

    previouslyFocusedRef.current = document.activeElement;
    setConfirmOpen(true);
  }, [isDeleting, isLoading]);

  const handleCloseConfirm = useCallback(() => {
    setConfirmOpen(false);

    const previouslyFocused = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;

    if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    await onDelete();
    handleCloseConfirm();
  }, [handleCloseConfirm, onDelete]);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const timeout = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timeout);
    };
  }, [confirmOpen, handleCloseConfirm]);

  const isDeleteDisabled = useMemo(() => isDeleting || isLoading, [isDeleting, isLoading]);

  return (
    <header className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">Review the recipe details and manage AI adaptations.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRetry ? (
          <Button onClick={onRetry} variant="outline" disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        ) : null}
        <Button variant="destructive" onClick={handleOpenConfirm} disabled={isDeleteDisabled}>
          {isDeleteDisabled ? "Deleting..." : "Delete"}
        </Button>
      </div>
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="absolute inset-0" aria-hidden="true" onClick={handleCloseConfirm} />
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-recipe-title"
            aria-describedby="delete-recipe-description"
            tabIndex={-1}
            className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl focus:outline-none"
          >
            <div className="space-y-2">
              <h2 id="delete-recipe-title" className="text-xl font-semibold text-foreground">
                Delete recipe
              </h2>
              <p id="delete-recipe-description" className="text-sm text-muted-foreground">
                This action cannot be undone. The recipe will be permanently removed. Are you sure you want to proceed?
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={handleCloseConfirm} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default HeaderBar;


