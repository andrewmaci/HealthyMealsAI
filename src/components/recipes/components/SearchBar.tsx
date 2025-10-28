import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useDebouncedValue } from "../query";

type SearchBarProps = {
  value?: string;
  onChange: (value?: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
};

const normalizeSearch = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const SearchBar = ({ value, onChange, isLoading, placeholder = "Search recipes", className }: SearchBarProps) => {
  const [inputValue, setInputValue] = useState(value ?? "");
  const debouncedValue = useDebouncedValue(inputValue, 350);

  useEffect(() => {
    setInputValue(value ?? "");
  }, [value]);

  useEffect(() => {
    const normalized = normalizeSearch(debouncedValue);

    if (normalized === value || (normalized === undefined && value === undefined)) {
      return;
    }

    onChange(normalized);
  }, [debouncedValue, onChange, value]);

  const handleImmediateSubmit = () => {
    const normalized = normalizeSearch(inputValue);

    if (normalized === value || (normalized === undefined && value === undefined)) {
      return;
    }

    onChange(normalized);
  };

  const hasValue = useMemo(() => inputValue.trim().length > 0, [inputValue]);

  return (
    <div className={cn("relative flex w-full items-center", className)}>
      <input
        type="search"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleImmediateSubmit();
          }
        }}
        placeholder={placeholder}
        aria-label="Search recipes"
        className="h-10 w-full rounded-md border border-input bg-background px-3 pr-20 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isLoading}
      />
      {hasValue ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs"
          onClick={() => {
            setInputValue("");
            onChange(undefined);
          }}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
};

export default SearchBar;

