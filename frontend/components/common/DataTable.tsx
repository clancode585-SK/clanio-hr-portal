"use client";

import React, { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Inbox,
} from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  isLoading?: boolean;
  initialPageSize?: number;
  title?: string;
  description?: string;
  actionButton?: React.ReactNode;
  isDarkMode?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search records...",
  isLoading = false,
  initialPageSize = 10,
  title,
  description,
  actionButton,
  isDarkMode = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: initialPageSize,
      },
    },
  });

  return (
    <div
      className={`w-full rounded-2xl border backdrop-blur-xl overflow-hidden flex flex-col transition-all duration-300 ${
        isDarkMode
          ? "bg-[#0B1A30]/90 border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white"
          : "bg-white border-slate-200/90 shadow-[0_15px_40px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)] text-slate-900"
      }`}
    >
      {/* Header Bar */}
      {(title || description || actionButton || searchPlaceholder) && (
        <div
          className={`p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isDarkMode
              ? "border-white/[0.08] bg-white/[0.02]"
              : "border-slate-200/80 bg-gradient-to-r from-slate-50 via-purple-50/30 to-indigo-50/30"
          }`}
        >
          <div>
            {title && (
              <div className="flex items-center gap-2.5">
                {!isDarkMode && (
                  <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-blue-600 via-indigo-600 to-purple-600" />
                )}
                <h3
                  className={`text-lg font-extrabold tracking-tight ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {title}
                </h3>
              </div>
            )}
            {description && (
              <p
                className={`text-xs font-medium mt-0.5 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Global Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  isDarkMode ? "text-slate-400" : "text-indigo-500"
                }`}
              />
              <input
                type="text"
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className={`w-full pl-9 pr-4 py-2.5 text-xs rounded-xl outline-none transition-all duration-200 ${
                  isDarkMode
                    ? "bg-white/[0.04] hover:bg-white/[0.07] focus:bg-[#081425] border border-white/[0.08] text-white placeholder-slate-400 focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/20"
                    : "bg-white border border-slate-300/80 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-2xs"
                }`}
              />
            </div>

            {/* Optional Action Button */}
            {actionButton && <div>{actionButton}</div>}
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          {/* Table Header */}
          <thead
            className={`border-b text-[11px] font-extrabold uppercase tracking-wider select-none ${
              isDarkMode
                ? "bg-[#081425] border-white/[0.08] text-slate-300"
                : "bg-gradient-to-r from-slate-100 via-purple-50/60 to-slate-100 border-b-2 border-indigo-500/20 text-slate-800"
            }`}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      className={`px-5 py-4 transition-colors ${
                        canSort
                          ? isDarkMode
                            ? "cursor-pointer hover:bg-white/[0.06]"
                            : "cursor-pointer hover:bg-purple-100/60 text-indigo-900"
                          : ""
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {canSort && (
                          <span className={isDarkMode ? "text-slate-400" : "text-indigo-500"}>
                            {isSorted === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-extrabold" />
                            ) : isSorted === "desc" ? (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-extrabold" />
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Table Body */}
          <tbody className={`divide-y ${isDarkMode ? "divide-white/[0.04]" : "divide-slate-100"}`}>
            {isLoading ? (
              // Skeleton rows loading state
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  {columns.map((_, cellIndex) => (
                    <td key={cellIndex} className="px-5 py-4">
                      <div
                        className={`h-4 rounded w-3/4 ${
                          isDarkMode ? "bg-white/10" : "bg-slate-200"
                        }`}
                      ></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`transition-all duration-150 group ${
                    isDarkMode
                      ? "even:bg-white/[0.015] hover:bg-purple-500/10"
                      : "even:bg-slate-50/50 hover:bg-gradient-to-r hover:from-purple-50/80 hover:via-indigo-50/40 hover:to-purple-50/80"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-5 py-3.5 text-xs font-normal ${
                        isDarkMode ? "text-slate-200" : "text-slate-700"
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              // Empty State
              <tr>
                <td
                  colSpan={columns.length}
                  className={`px-6 py-12 text-center ${
                    isDarkMode ? "text-slate-400" : "text-slate-400"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox
                      className={`w-10 h-10 stroke-[1.5] ${
                        isDarkMode ? "text-slate-500" : "text-slate-300"
                      }`}
                    />
                    <p
                      className={`text-base font-bold ${
                        isDarkMode ? "text-slate-200" : "text-slate-700"
                      }`}
                    >
                      No records found
                    </p>
                    <p
                      className={`text-xs ${
                        isDarkMode ? "text-slate-400" : "text-slate-400"
                      }`}
                    >
                      Try adjusting your search or filters.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
          isDarkMode
            ? "border-white/[0.08] bg-[#081425]/80 text-slate-400"
            : "border-slate-100 bg-slate-50/80 text-slate-500"
        }`}
      >
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className={`px-2 py-1 rounded-lg border font-semibold outline-none transition-colors ${
              isDarkMode
                ? "bg-[#0B1A30] border-white/10 text-slate-200 focus:border-purple-500"
                : "bg-white border-slate-200 text-slate-700 focus:border-purple-500"
            }`}
          >
            {[5, 10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="ml-2">
            Showing{" "}
            <span
              className={`font-bold ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
            >
              {table.getRowModel().rows.length > 0
                ? table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                  1
                : 0}
            </span>{" "}
            to{" "}
            <span
              className={`font-bold ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
            >
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}
            </span>{" "}
            of{" "}
            <span
              className={`font-bold ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
            >
              {table.getFilteredRowModel().rows.length}
            </span>{" "}
            entries
          </span>
        </div>

        {/* Page controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className={`p-1.5 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
              isDarkMode
                ? "border-white/10 bg-white/[0.04] hover:bg-white/10 text-slate-200"
                : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
            }`}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className={`p-1.5 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
              isDarkMode
                ? "border-white/10 bg-white/[0.04] hover:bg-white/10 text-slate-200"
                : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
            }`}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span
            className={`px-3 py-1 font-bold ${
              isDarkMode ? "text-slate-200" : "text-slate-800"
            }`}
          >
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className={`p-1.5 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
              isDarkMode
                ? "border-white/10 bg-white/[0.04] hover:bg-white/10 text-slate-200"
                : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
            }`}
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className={`p-1.5 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
              isDarkMode
                ? "border-white/10 bg-white/[0.04] hover:bg-white/10 text-slate-200"
                : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
            }`}
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
