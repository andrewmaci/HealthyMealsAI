import { cn } from "@/lib/utils";

import type { RecipeSortBy, SortOrder } from "../types";

interface SortControlsProps {
  sortBy: RecipeSortBy;
  sortOrder: SortOrder;
  onChange: (next: { sortBy: RecipeSortBy; sortOrder: SortOrder }) => void;
  className?: string;
}

const SortControls = ({ sortBy, sortOrder, onChange, className }: SortControlsProps) => (
  <div className={cn("flex flex-wrap items-center gap-2", className)}>
    <label htmlFor="sort-by" className="text-sm font-medium">
      Sort by
    </label>
    <select
      id="sort-by"
      value={sortBy}
      onChange={(event) =>
        onChange({
          sortBy: event.target.value as RecipeSortBy,
          sortOrder,
        })
      }
      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
    >
      <option value="updated_at">Recently updated</option>
      <option value="created_at">Recently created</option>
      <option value="title">Title</option>
    </select>
    <label htmlFor="sort-order" className="sr-only">
      Sort order
    </label>
    <select
      id="sort-order"
      value={sortOrder}
      onChange={(event) =>
        onChange({
          sortBy,
          sortOrder: event.target.value as SortOrder,
        })
      }
      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
    >
      <option value="desc">Descending</option>
      <option value="asc">Ascending</option>
    </select>
  </div>
);

export default SortControls;
