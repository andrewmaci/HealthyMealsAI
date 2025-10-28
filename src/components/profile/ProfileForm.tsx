import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ProfileUpdateDtoSchema } from "@/types";

import { TagInput } from "./TagInput";
import { TimezoneSelect } from "./TimezoneSelect";
import { useTimezones } from "./useTimezones";
import type { ProfileFormErrors, ProfileFormValues } from "./types";

interface ProfileFormProps {
  initialValues: ProfileFormValues;
  lastModified: string;
  onSave: (values: ProfileFormValues) => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  saving: boolean;
}

const flattenErrors = (error: z.ZodError<ProfileFormValues>): ProfileFormErrors => {
  const errors: ProfileFormErrors = {};
  const formErrors = error.formErrors?.formErrors ?? [];

  if (formErrors.length > 0) {
    errors.form = formErrors.join(" ");
  }

  const fieldErrors = error.flatten().fieldErrors;

  if (fieldErrors.allergens?.length) {
    errors.allergens = fieldErrors.allergens[0];
  }

  if (fieldErrors.dislikedIngredients?.length) {
    errors.dislikedIngredients = fieldErrors.dislikedIngredients[0];
  }

  if (fieldErrors.timezone?.length) {
    errors.timezone = fieldErrors.timezone[0];
  }

  return errors;
};

export function ProfileForm({
  initialValues,
  lastModified,
  onSave,
  onSuccess,
  onError,
  saving,
}: ProfileFormProps) {
  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const timezones = useTimezones();

  useEffect(() => {
    setValues(initialValues);
    setIsDirty(false);
    setErrors({});
  }, [initialValues, lastModified]);

  const validate = useCallback((next: ProfileFormValues) => {
    const result = ProfileUpdateDtoSchema.safeParse(next);

    if (!result.success) {
      setErrors(flattenErrors(result.error));
      return false;
    }

    setErrors({});
    return true;
  }, []);

  const handleChange = useCallback(
    (next: ProfileFormValues) => {
      setValues(next);
      const dirty = JSON.stringify(next) !== JSON.stringify(initialValues);
      setIsDirty(dirty);
      if (hasAttemptedSubmit) {
        validate(next);
      }
    },
    [initialValues, hasAttemptedSubmit, validate],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setHasAttemptedSubmit(true);

      const isValid = validate(values);

      if (!isValid) {
        onError?.({ kind: "validation" });
        return;
      }

      if (!isDirty) {
        return;
      }

      try {
        await onSave(values);
        setIsDirty(false);
        setErrors({});
        setHasAttemptedSubmit(false);
        onSuccess?.();
      } catch (error) {
        onError?.(error);
      }
    },
    [isDirty, onError, onSave, onSuccess, validate, values],
  );

  const canSubmit = useMemo(() => {
    if (saving) {
      return false;
    }

    if (!isDirty) {
      return false;
    }

    return Object.keys(errors).length === 0;
  }, [errors, isDirty, saving]);

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <TagInput
        label="Allergens"
        value={values.allergens}
        onChange={(next) =>
          handleChange({
            ...values,
            allergens: next,
          })
        }
        placeholder="Add an allergen and press Enter"
        disabled={saving}
        error={errors.allergens}
      />
      <TagInput
        label="Disliked ingredients"
        value={values.dislikedIngredients}
        onChange={(next) =>
          handleChange({
            ...values,
            dislikedIngredients: next,
          })
        }
        placeholder="Add a disliked ingredient and press Enter"
        disabled={saving}
        error={errors.dislikedIngredients}
      />
      <TimezoneSelect
        label="Timezone"
        value={values.timezone}
        options={timezones}
        onChange={(next) =>
          handleChange({
            ...values,
            timezone: next,
          })
        }
        disabled={saving}
        error={errors.timezone}
      />
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValues(initialValues);
            setErrors({});
            setIsDirty(false);
            setHasAttemptedSubmit(false);
          }}
          disabled={saving || !isDirty}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}

