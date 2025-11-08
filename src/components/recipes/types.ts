export type RecipeSortBy = "created_at" | "updated_at" | "title";

export type SortOrder = "asc" | "desc";

export interface RecipeListQueryState {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: RecipeSortBy;
  sortOrder: SortOrder;
  minKcal?: number;
  maxKcal?: number;
  minProtein?: number;
  maxProtein?: number;
}

export type FilterFormValues = Pick<RecipeListQueryState, "minKcal" | "maxKcal" | "minProtein" | "maxProtein">;

export interface RecipeListItemVM {
  id: string;
  title: string;
  servings: number;
  macros: { kcal: number; protein: number; carbs: number; fat: number };
  updatedAtIso: string;
  updatedAtRelative: string;
}

export interface ApiError {
  status: 400 | 401 | 500;
  message: string;
}
