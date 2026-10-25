"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2, Layers } from "lucide-react";
import {
  Employee,
  Department,
  DesignationItem,
  CompanyItem,
  BranchItem,
  TeamItem,
  RoleItem,
} from "./types";

export type EntityType =
  | "employees"
  | "departments"
  | "designations"
  | "companies"
  | "branches"
  | "teams"
  | "roles";

interface ColumnOptions {
  isDarkMode: boolean;
  onViewDetails: (item: any, entity: EntityType) => void;
  onOpenEditModal: (item: any, entity: EntityType) => void;
  onOpenDeleteModal: (item: any, entity: EntityType) => void;
  onManageModules?: (item: any) => void;
}

export const renderActionButtons = (
  item: any,
  entity: EntityType,
  { isDarkMode, onViewDetails, onOpenEditModal, onOpenDeleteModal }: ColumnOptions
) => (
  <div className="flex items-center gap-1.5">
    <button
      onClick={() => onViewDetails(item, entity)}
      title="View Details"
      className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
        isDarkMode
          ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white"
          : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 hover:text-slate-900"
      }`}
    >
      <Eye className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={() => onOpenEditModal(item, entity)}
      title="Edit"
      className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
        isDarkMode
          ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30 hover:text-blue-300"
          : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 hover:text-blue-700"
      }`}
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={() => onOpenDeleteModal(item, entity)}
      title="Delete"
      className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
        isDarkMode
          ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 hover:text-rose-300"
          : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 hover:text-rose-700"
      }`}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

export const getEmployeeColumns = (opts: ColumnOptions): ColumnDef<Employee>[] => [
  {
    accessorKey: "id",
    header: "Employee ID",
    cell: (info) => (
      <span
        className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border shadow-2xs ${
          opts.isDarkMode
            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
            : "bg-purple-50 text-purple-700 border-purple-200"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Full Name",
    cell: (info) => {
      const name = info.getValue() as string;
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2);
      return (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 p-0.5 shadow-sm shrink-0">
            <div
              className={`w-full h-full rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                opts.isDarkMode ? "bg-[#081425] text-white" : "bg-white text-slate-900"
              }`}
            >
              {initials}
            </div>
          </div>
          <span
            className={`font-bold text-xs sm:text-sm ${
              opts.isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {name}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-600"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "role",
    header: "Role / Designation",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "branch",
    header: "Branch",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {(info.getValue() as string) || "Corporate HQ"}
      </span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: (info) => renderActionButtons(info.row.original, "employees", opts),
  },
];

export const getDepartmentColumns = (opts: ColumnOptions): ColumnDef<Department>[] => [
  {
    accessorKey: "code",
    header: "Code",
    cell: (info) => (
      <span
        className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
          opts.isDarkMode
            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            : "bg-cyan-50 text-cyan-700 border-cyan-200"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Department Name",
    cell: (info) => (
      <span
        className={`font-bold text-xs sm:text-sm ${
          opts.isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "head",
    header: "Department Head",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-600"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "employeesCount",
    header: "Total Members",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as number} members
      </span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: (info) => renderActionButtons(info.row.original, "departments", opts),
  },
];

export const getDesignationColumns = (opts: ColumnOptions): ColumnDef<DesignationItem>[] => [
  {
    accessorKey: "code",
    header: "Code",
    cell: (info) => (
      <span
        className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
          opts.isDarkMode
            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            : "bg-cyan-50 text-cyan-700 border-cyan-200"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Designation Name",
    cell: (info) => (
      <span
        className={`font-bold text-xs sm:text-sm ${
          opts.isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "departmentName",
    header: "Department",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-600"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "employeesCount",
    header: "Total Employees",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as number} employees
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: (info) => {
      const status = (info.getValue() as string) || "active";
      return (
        <span
          className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
            status === "active"
              ? opts.isDarkMode
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
              : opts.isDarkMode
              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          {status}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: (info) => renderActionButtons(info.row.original, "designations", opts),
  },
];

export const getCompanyColumns = (opts: ColumnOptions): ColumnDef<CompanyItem>[] => [
  {
    accessorKey: "name",
    header: "Company Name",
    cell: (info) => (
      <span
        className={`font-bold text-xs sm:text-sm ${
          opts.isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: (info) => (
      <span
        className={`font-mono text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "email",
    header: "Company Email",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-600"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: (info) => {
      const status = (info.getValue() as string) || "active";
      return (
        <span
          className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
            status === "active"
              ? opts.isDarkMode
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
              : opts.isDarkMode
              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          {status}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: (info) => (
      <div className="flex items-center gap-1.5">
        {opts.onManageModules && (
          <button
            onClick={() => opts.onManageModules?.(info.row.original)}
            title="Tenant Feature Modules"
            className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
              opts.isDarkMode
                ? "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30 hover:text-purple-300"
                : "bg-purple-50 hover:bg-purple-100 text-purple-600 border-purple-200 hover:text-purple-700"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        )}
        {renderActionButtons(info.row.original, "companies", opts)}
      </div>
    ),
  },
];

export const getBranchColumns = (opts: ColumnOptions): ColumnDef<BranchItem>[] => [
  {
    accessorKey: "code",
    header: "Branch Code",
    cell: (info) => (
      <span
        className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
          opts.isDarkMode
            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            : "bg-cyan-50 text-cyan-700 border-cyan-200"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Branch Name",
    cell: (info) => (
      <span
        className={`font-bold text-xs sm:text-sm ${
          opts.isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "companyName",
    header: "Company",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "usersCount",
    header: "Total Members",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as number} members
      </span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: (info) => renderActionButtons(info.row.original, "branches", opts),
  },
];

export const getTeamColumns = (opts: ColumnOptions): ColumnDef<TeamItem>[] => [
  {
    accessorKey: "code",
    header: "Team Code",
    cell: (info) => (
      <span
        className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
          opts.isDarkMode
            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
            : "bg-purple-50 text-purple-700 border-purple-200"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Team Name",
    cell: (info) => (
      <span
        className={`font-bold text-xs sm:text-sm ${
          opts.isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "departmentName",
    header: "Department",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "usersCount",
    header: "Members",
    cell: (info) => (
      <span
        className={`text-xs font-medium ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as number} members
      </span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: (info) => renderActionButtons(info.row.original, "teams", opts),
  },
];

export const getRoleColumns = (opts: ColumnOptions): ColumnDef<RoleItem>[] => [
  {
    accessorKey: "slug",
    header: "Role Slug",
    cell: (info) => (
      <span
        className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
          opts.isDarkMode
            ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Role Name",
    cell: (info) => (
      <span
        className={`font-bold text-xs sm:text-sm ${
          opts.isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "data_scope",
    header: "Data Scope",
    cell: (info) => (
      <span
        className={`font-mono text-xs font-medium uppercase ${
          opts.isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {info.getValue() as string}
      </span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: (info) => renderActionButtons(info.row.original, "roles", opts),
  },
];
