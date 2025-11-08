import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FilterFormValues } from "../types";

const parseNumber = (value: string): number | undefined => {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

type FilterFieldKey = keyof FilterFormValues;

type ValidationErrors = Partial<Record<FilterFieldKey, string>>;

interface FilterModalProps {
  open: boolean;
  initialValues: FilterFormValues;
  onClose: () => void;
  onApply: (values: FilterFormValues) => void;
  onReset: () => void;
}

const validateFilters = (values: FilterFormValues): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (values.minKcal !== undefined && values.maxKcal !== undefined && values.minKcal > values.maxKcal) {
    errors.minKcal = "Minimum kcal cannot exceed maximum.";
  }

  if (values.minProtein !== undefined && values.maxProtein !== undefined && values.minProtein > values.maxProtein) {
    errors.minProtein = "Minimum protein cannot exceed maximum.";
  }

  return errors;
};

const formatValue = (value: number | undefined) => (value === undefined ? "" : String(value));

const FilterModal = ({ open, initialValues, onClose, onApply, onReset }: FilterModalProps) => {
  const [formValues, setFormValues] = useState<FilterFormValues>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (open) {
      setFormValues(initialValues);
      setErrors({});
    }
  }, [initialValues, open]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  useEffect(() => {
    setErrors(validateFilters(formValues));
  }, [formValues]);

  const handleChange = (key: FilterFieldKey, rawValue: string) => {
    setFormValues((previous) => ({
      ...previous,
      [key]: parseNumber(rawValue),
    }));
  };

  const handleApply = () => {
    const nextErrors = validateFilters(formValues);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onApply(formValues);
    onClose();
  };

  const handleReset = () => {
    setFormValues({});
    onReset();
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-filter-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <header className="border-b border-border px-6 py-4">
          <h2 id="recipe-filter-modal-title" className="text-lg font-semibold">
            Filter recipes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Set minimum or maximum values for calories and protein.</p>
        </header>

        <div className="px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Minimum kcal</span>
              <input
                inputMode="numeric"
                min={0}
                type="number"
                value={formatValue(formValues.minKcal)}
                onChange={(event) => handleChange("minKcal", event.target.value)}
                className={cn(
                  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
                  errors.minKcal
                    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : undefined
                )}
                aria-invalid={Boolean(errors.minKcal)}
                aria-describedby={errors.minKcal ? "filter-min-kcal-error" : undefined}
              />
              {errors.minKcal ? (
                <span id="filter-min-kcal-error" className="text-xs text-destructive">
                  {errors.minKcal}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Maximum kcal</span>
              <input
                inputMode="numeric"
                min={0}
                type="number"
                value={formatValue(formValues.maxKcal)}
                onChange={(event) => handleChange("maxKcal", event.target.value)}
                className={cn(
                  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
                  errors.minKcal
                    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : undefined
                )}
                aria-invalid={Boolean(errors.minKcal)}
                aria-describedby={errors.minKcal ? "filter-min-kcal-error" : undefined}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Minimum protein (g)</span>
              <input
                inputMode="numeric"
                min={0}
                type="number"
                value={formatValue(formValues.minProtein)}
                onChange={(event) => handleChange("minProtein", event.target.value)}
                className={cn(
                  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
                  errors.minProtein
                    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : undefined
                )}
                aria-invalid={Boolean(errors.minProtein)}
                aria-describedby={errors.minProtein ? "filter-min-protein-error" : undefined}
              />
              {errors.minProtein ? (
                <span id="filter-min-protein-error" className="text-xs text-destructive">
                  {errors.minProtein}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Maximum protein (g)</span>
              <input
                inputMode="numeric"
                min={0}
                type="number"
                value={formatValue(formValues.maxProtein)}
                onChange={(event) => handleChange("maxProtein", event.target.value)}
                className={cn(
                  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
                  errors.minProtein
                    ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                    : undefined
                )}
                aria-invalid={Boolean(errors.minProtein)}
                aria-describedby={errors.minProtein ? "filter-min-protein-error" : undefined}
              />
            </label>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={handleReset}>
              Reset
            </Button>
            <Button type="button" onClick={handleApply} disabled={!isValid}>
              Apply
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FilterModal;
