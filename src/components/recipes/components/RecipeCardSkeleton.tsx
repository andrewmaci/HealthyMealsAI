import { cn } from "@/lib/utils";

interface RecipeCardSkeletonProps {
  count?: number;
  className?: string;
}

const RecipeCardSkeleton = ({ count = 6, className }: RecipeCardSkeletonProps) => (
  <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)} aria-hidden>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="flex h-48 flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="grid gap-2">
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-auto h-9 w-20 animate-pulse rounded bg-muted" />
      </div>
    ))}
  </div>
);

export default RecipeCardSkeleton;
