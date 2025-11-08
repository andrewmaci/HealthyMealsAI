import { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";

import { InlineError } from "@/components/recipes/form/InlineError";
import { cn } from "@/lib/utils";

type InputBaseProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type" | "name" | "id" | "children"
>;

interface FormFieldProps extends InputBaseProps {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  description?: string;
  inputMode?: "text" | "email" | "numeric";
  id?: string;
  dataTestId?: string;
}

export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  description,
  required,
  disabled,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  minLength,
  spellCheck,
  id,
  dataTestId,
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-${name}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const [showPassword, setShowPassword] = useState(false);
  const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const isPasswordField = type === "password";
  const inputType = isPasswordField && showPassword ? "text" : type;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={inputType}
          value={value}
          data-test-id={dataTestId}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          minLength={minLength}
          spellCheck={spellCheck}
          required={required}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={ariaDescribedBy}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error ? "border-destructive focus-visible:ring-destructive/80" : "border-input focus-visible:ring-ring/60",
            disabled ? "cursor-not-allowed opacity-70" : undefined,
            isPasswordField ? "pr-10" : undefined
          )}
        />
        {isPasswordField ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-primary transition hover:text-primary/80 focus:outline-none"
            onClick={() => setShowPassword((previous) => !previous)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      <InlineError id={errorId} message={error} />
    </div>
  );
}
