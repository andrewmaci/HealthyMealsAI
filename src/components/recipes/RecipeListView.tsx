import { useCallback, useMemo, useState } from "react";

import ErrorBanner from "./components/ErrorBanner";
import EmptyState from "./components/EmptyState";
import FilterButton from "./components/FilterButton";
import FilterModal from "./components/FilterModal";
import Pagination from "./components/Pagination";
import RecipeGrid from "./components/RecipeGrid";
import ResultsSummary from "./components/ResultsSummary";
import SearchBar from "./components/SearchBar";
import SortControls from "./components/SortControls";
import { DEFAULT_QUERY, useQueryStateSync, useRecipes } from "./query";
import type { FilterFormValues, RecipeSortBy, SortOrder } from "./types";

const extractFilters = (filters: FilterFormValues): FilterFormValues => ({ ...filters });

const RecipeListView = () => {
  const { query, setQuery } = useQueryStateSync();
  const { data, items, isLoading, error, refetch } = useRecipes(query);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<FilterFormValues>(() => extractFilters(query));

  const appliedFilters = useMemo(() => extractFilters(query), [query]);

  const pagination = data?.pagination ?? {
    page: query.page,
    pageSize: query.pageSize,
    totalItems: 0,
    totalPages: 0,
  };

  const handleSearchChange = useCallback(
    (value?: string) => {
      setQuery((current) => ({
        ...current,
        page: DEFAULT_QUERY.page,
        search: value,
      }));
    },
    [setQuery],
  );

  const handleSortChange = useCallback(
    (next: { sortBy: RecipeSortBy; sortOrder: SortOrder }) => {
      setQuery((current) => ({
        ...current,
        page: DEFAULT_QUERY.page,
        sortBy: next.sortBy,
        sortOrder: next.sortOrder,
      }));
    },
    [setQuery],
  );

  const handleApplyFilters = useCallback(
    (filters: FilterFormValues) => {
      setQuery((current) => ({
        ...current,
        page: DEFAULT_QUERY.page,
        minKcal: filters.minKcal,
        maxKcal: filters.maxKcal,
        minProtein: filters.minProtein,
        maxProtein: filters.maxProtein,
      }));
      setIsFilterOpen(false);
    },
    [setQuery],
  );

  const handleResetFilters = useCallback(() => {
    setQuery((current) => ({
      ...current,
      page: DEFAULT_QUERY.page,
      minKcal: undefined,
      maxKcal: undefined,
      minProtein: undefined,
      maxProtein: undefined,
    }));
    setPendingFilters({});
  }, [setQuery]);

  const handlePageChange = useCallback(
    (page: number) => {
      setQuery((current) => ({
        ...current,
        page,
      }));
    },
    [setQuery],
  );

  const handleOpenFilters = () => {
    setPendingFilters(appliedFilters);
    setIsFilterOpen(true);
  };

  const handleCloseFilters = () => {
    setIsFilterOpen(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Recipes</h1>
        <p className="text-sm text-muted-foreground">Search, filter, and manage your saved recipes.</p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 backdrop-blur transition md:flex-row md:items-center md:justify-between">
        <SearchBar value={query.search} onChange={handleSearchChange} isLoading={isLoading} className="md:flex-1" />
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <FilterButton activeFilters={appliedFilters} onOpen={handleOpenFilters} onReset={handleResetFilters} />
          <SortControls sortBy={query.sortBy} sortOrder={query.sortOrder} onChange={handleSortChange} />
        </div>
      </section>

      <ErrorBanner error={error} onRetry={refetch} />

      {data ? <ResultsSummary pagination={pagination} itemsOnPage={items.length} /> : null}

      {items.length === 0 && !isLoading && !error ? <EmptyState /> : <RecipeGrid items={items} isLoading={isLoading} />}

      <Pagination pagination={pagination} onPageChange={handlePageChange} isLoading={isLoading} />

      <FilterModal
        open={isFilterOpen}
        initialValues={pendingFilters}
        onClose={handleCloseFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </div>
  );
};

export default RecipeListView;

