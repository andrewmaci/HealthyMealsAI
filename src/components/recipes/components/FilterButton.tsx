import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FilterFormValues } from "../types";

interface FilterButtonProps {
  activeFilters: FilterFormValues;
  onOpen: () => void;
  onReset: () => void;
  className?: string;
}

const countActiveFilters = (filters: FilterFormValues) =>
  Object.values(filters).filter((value) => value !== undefined).length;

const FilterButton = ({ activeFilters, onOpen, onReset, className }: FilterButtonProps) => {
  const activeCount = countActiveFilters(activeFilters);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button type="button" variant="outline" onClick={onOpen} className="gap-2">
        Filters
        {activeCount > 0 ? (
          <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            {activeCount}
          </span>
        ) : null}
      </Button>
      <Button type="button" variant="ghost" disabled={activeCount === 0} onClick={onReset}>
        Clear
      </Button>
    </div>
  );
};

export default FilterButton;
