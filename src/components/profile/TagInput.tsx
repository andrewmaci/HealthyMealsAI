import { useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_MAX = 50;

type TagList = string[];

interface TagInputProps {
  label: string;
  value: TagList;
  onChange: (next: TagList) => void;
  placeholder?: string;
  max?: number;
  ariaDescribedBy?: string;
  disabled?: boolean;
  error?: string;
}

export function TagInput({
  label,
  value,
  onChange,
  placeholder,
  max = DEFAULT_MAX,
  ariaDescribedBy,
  disabled,
  error,
}: TagInputProps) {
  const inputId = useId();
  const helperId = useId();
  const errorId = useId();
  const [inputValue, setInputValue] = useState("");
  const [focusedChipIndex, setFocusedChipIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const remaining = Math.max(0, max - value.length);

  const helperText = useMemo(() => {
    if (disabled) {
      return "";
    }

    if (remaining === 0) {
      return "Maximum entries reached.";
    }

    return `${remaining} entries remaining.`;
  }, [disabled, remaining]);

  const addTag = (raw: string) => {
    const trimmed = raw.trim();

    if (!trimmed) {
      return;
    }

    if (value.length >= max) {
      return;
    }

    const normalized = trimmed.toLowerCase();
    const hasDuplicate = value.some((existing) => existing.toLowerCase() === normalized);

    if (hasDuplicate) {
      return;
    }

    onChange([...value, trimmed]);
    setInputValue("");
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
    const nextIndex = Math.min(index, value.length - 2);
    setFocusedChipIndex(nextIndex >= 0 ? nextIndex : null);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="flex items-center justify-between text-sm font-medium text-foreground">
        {label}
        <span className="text-xs text-muted-foreground">{value.length}/{max}</span>
      </label>
      <div
        className={cn(
          "flex flex-wrap gap-2 rounded-md border bg-background px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
          disabled && "bg-muted/50 text-muted-foreground",
          error && "border-destructive",
        )}
      >
        {value.map((tag, index) => (
          <span
            key={tag}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary",
              focusedChipIndex === index && "ring-2 ring-primary",
            )}
            role="button"
            tabIndex={-1}
            aria-label={`Remove ${tag}`}
          >
            {tag}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 rounded-full bg-primary/20 p-1 text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => removeAt(index)}
              disabled={disabled}
            >
              <span className="sr-only">Remove {tag}</span>
              ×
            </Button>
          </span>
        ))}
        <input
          id={inputId}
          ref={inputRef}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onFocus={() => setFocusedChipIndex(null)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(inputValue);
              return;
            }

            if (event.key === "Backspace" && inputValue.length === 0 && value.length > 0) {
              event.preventDefault();
              const lastIndex = value.length - 1;
              setFocusedChipIndex(lastIndex);
              removeAt(lastIndex);
            }
          }}
          onBlur={() => {
            if (inputValue.trim()) {
              addTag(inputValue);
            }
          }}
          placeholder={placeholder}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text");
            pasted
              .split(/[\n,]+/)
              .map((item) => item.trim())
              .filter(Boolean)
              .forEach(addTag);
          }}
          disabled={disabled || value.length >= max}
          aria-describedby={cn(helperId, ariaDescribedBy, error ? errorId : undefined)}
          aria-invalid={Boolean(error)}
          className="min-w-[160px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <p id={helperId} className="text-xs text-muted-foreground">
        {helperText}
      </p>
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

