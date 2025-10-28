import RecipeCard from "./RecipeCard";
import RecipeCardSkeleton from "./RecipeCardSkeleton";

import type { RecipeListItemVM } from "../types";

type RecipeGridProps = {
  items: RecipeListItemVM[];
  isLoading: boolean;
  skeletonCount?: number;
};

const RecipeGrid = ({ items, isLoading, skeletonCount = 6 }: RecipeGridProps) => {
  if (isLoading && items.length === 0) {
    return <RecipeCardSkeleton count={skeletonCount} />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <h3 className="text-lg font-semibold">No recipes found</h3>
        <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters or create a new recipe.</p>
        <a
          href="/recipes/new"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Create recipe
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <RecipeCard key={item.id} item={item} />
      ))}
    </div>
  );
};

export default RecipeGrid;

