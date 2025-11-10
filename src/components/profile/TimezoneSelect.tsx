import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TimezoneOption {
  id: string;
  label: string;
}

interface TimezoneSelectProps {
  label: string;
  value: string | null;
  options: TimezoneOption[];
  onChange: (next: string | null) => void;
  disabled?: boolean;
  error?: string;
}

export function TimezoneSelect({ label, value, options, onChange, disabled, error }: TimezoneSelectProps) {
  const sortedOptions = useMemo(() => options, [options]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(
            "rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            disabled && "bg-muted/40",
            error && "border-destructive"
          )}
        >
          <option value="">UTC (default)</option>
          {sortedOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {value !== null && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}>
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Used to reset your AI quota at local midnight. Defaults to UTC if unset.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
