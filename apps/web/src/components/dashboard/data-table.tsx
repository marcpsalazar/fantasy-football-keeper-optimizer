"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownUp, ChevronDown, Filter } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyLabel?: string;
  resetSignal?: number;
  scrollBody?: boolean;
  scrollBodyClassName?: string;
  tableId?: string;
  teamFilter?: {
    columnId: string;
    title?: string;
  };
};

type PersistedTableDisplaySettings = {
  selectedTeams: string[];
  sorting: SortingState;
  teamSearch: string;
};

const persistedTableDisplaySettings = new Map<string, PersistedTableDisplaySettings>();

export function resetDataTableDisplaySettings(): void {
  persistedTableDisplaySettings.clear();
}

export function DataTable<TData>({
  columns,
  data,
  emptyLabel = "No rows",
  resetSignal = 0,
  scrollBody = false,
  scrollBodyClassName,
  tableId,
  teamFilter,
}: DataTableProps<TData>) {
  const persistedSettings = tableId ? persistedTableDisplaySettings.get(tableId) : undefined;
  const [sorting, setSorting] = React.useState<SortingState>(persistedSettings?.sorting ?? []);
  const [isTeamFilterOpen, setIsTeamFilterOpen] = React.useState(false);
  const [teamSearch, setTeamSearch] = React.useState(persistedSettings?.teamSearch ?? "");
  const [selectedTeams, setSelectedTeams] = React.useState<string[]>(
    persistedSettings?.selectedTeams ?? [],
  );
  const teamFilterRef = React.useRef<HTMLDivElement | null>(null);
  const previousResetSignal = React.useRef(resetSignal);
  const teamOptions = React.useMemo(() => {
    if (!teamFilter) {
      return [];
    }

    const options = new Set<string>();
    for (const row of data) {
      const value = rowValue(row, teamFilter.columnId);
      if (value) {
        options.add(value);
      }
    }

    return Array.from(options).sort((left, right) => left.localeCompare(right));
  }, [data, teamFilter]);
  const matchingTeamOptions = React.useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) {
      return teamOptions;
    }
    return teamOptions.filter((team) => team.toLowerCase().includes(query));
  }, [teamOptions, teamSearch]);
  const filteredData = React.useMemo(() => {
    if (!teamFilter || selectedTeams.length === 0) {
      return data;
    }

    const selectedSet = new Set(selectedTeams);
    return data.filter((row) => {
      const value = rowValue(row, teamFilter.columnId);
      return value ? selectedSet.has(value) : false;
    });
  }, [data, selectedTeams, teamFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const clearTeamFilter = React.useCallback(() => {
    setSelectedTeams([]);
    setTeamSearch("");
  }, []);

  const toggleTeam = React.useCallback((team: string) => {
    setSelectedTeams((current) =>
      current.includes(team) ? current.filter((entry) => entry !== team) : [...current, team],
    );
  }, []);

  React.useEffect(() => {
    if (!tableId) {
      return;
    }

    persistedTableDisplaySettings.set(tableId, {
      selectedTeams,
      sorting,
      teamSearch,
    });
  }, [selectedTeams, sorting, tableId, teamSearch]);

  React.useEffect(() => {
    if (previousResetSignal.current === resetSignal) {
      return;
    }
    previousResetSignal.current = resetSignal;
    setSorting([]);
    setSelectedTeams([]);
    setTeamSearch("");
    setIsTeamFilterOpen(false);
  }, [resetSignal]);

  React.useEffect(() => {
    if (!isTeamFilterOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!teamFilterRef.current?.contains(event.target as Node)) {
        setIsTeamFilterOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTeamFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isTeamFilterOpen]);

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700">
      {teamFilter ? (
        <div className="border-b border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/60">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-zinc-500">
                {teamFilter.title ?? "Filter by Team"}
              </p>
              <p className="mt-1 truncate text-sm text-zinc-600">
                {selectedTeams.length
                  ? `${selectedTeams.length} team${selectedTeams.length === 1 ? "" : "s"} selected`
                  : "Showing all teams"}
              </p>
            </div>
            <div className="relative shrink-0" ref={teamFilterRef}>
              <Button
                className="h-8 gap-2 px-3 text-xs"
                onClick={() => setIsTeamFilterOpen((current) => !current)}
                variant="outline"
              >
                <Filter className="size-3.5" aria-hidden="true" />
                Team Filter
                {selectedTeams.length ? <Badge variant="info">{selectedTeams.length}</Badge> : null}
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </Button>
              {isTeamFilterOpen ? (
                <div className="absolute right-0 top-10 z-20 w-[320px] rounded-md border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900">Filter teams</p>
                    <Button
                      className="h-7 px-2 text-xs"
                      disabled={selectedTeams.length === 0 && teamSearch.length === 0}
                      onClick={clearTeamFilter}
                      variant="ghost"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <Input
                      aria-label="Search teams"
                      onChange={(event) => setTeamSearch(event.target.value)}
                      placeholder="Search team names"
                      value={teamSearch}
                    />
                    <div className="max-h-64 overflow-y-auto rounded-md border border-zinc-200">
                      {matchingTeamOptions.length ? (
                        matchingTeamOptions.map((team) => {
                          const active = selectedTeams.includes(team);
                          return (
                            <button
                              aria-pressed={active}
                              className={["flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                                active
                                  ? "bg-emerald-50 text-emerald-950"
                                  : "text-zinc-700 hover:bg-zinc-50",
                              ].join(" ")}
                              key={team}
                              onClick={() => toggleTeam(team)}
                              type="button"
                            >
                              <span
                                aria-hidden="true"
                                className={[
                                  "flex size-4 items-center justify-center rounded-sm border text-[10px] font-semibold",
                                  active
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-zinc-300 bg-white text-transparent",
                                ].join(" ")}
                              >
                                ✓
                              </span>
                              <span className="truncate">{team}</span>
                            </button>
                          );
                        })
                      ) : (
                        <p className="px-3 py-4 text-sm text-zinc-500">No teams match the current search.</p>
                      )}
                    </div>
                    {selectedTeams.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedTeams.map((team) => (
                          <Badge key={team} variant="info">
                            {team}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          scrollBody ? "max-h-[70vh] overflow-auto" : "overflow-x-auto",
          scrollBodyClassName,
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent dark:hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={cn(
                      scrollBody &&
                        "sticky top-0 z-10 bg-zinc-50 shadow-[inset_0_-1px_0_#e4e4e7] dark:bg-zinc-800 dark:shadow-[inset_0_-1px_0_#3f3f46]",
                      (header.column.columnDef.meta as { className?: string } | undefined)?.className,
                    )}
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <Button
                        className="-ml-2 h-8 px-2 text-xs uppercase text-zinc-500 hover:text-zinc-950"
                        variant="ghost"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowDownUp className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                    className={(cell.column.columnDef.meta as { className?: string } | undefined)?.className}
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-24 text-center text-zinc-500" colSpan={columns.length}>
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function rowValue<TData>(row: TData, key: string): string | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
