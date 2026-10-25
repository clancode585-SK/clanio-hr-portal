"use client";

import React, { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { fetchApi, extractList } from "@/lib/api";
import {
  Laptop,
  Plus,
  CheckCircle2,
  XCircle,
  UserCheck,
  Check,
  X,
  RotateCcw,
  Box,
  FileCheck,
} from "lucide-react";

// Interfaces
interface AssetItem {
  id: number;
  asset_code: string;
  category: string; // laptop, desktop, mobile, monitor, accessory, peripheral, vehicle, furniture, other
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  status: string; // available, allocated, maintenance, retired, lost
  condition_state: string; // new, good, fair, poor, damaged
  allocated_employee_name?: string;
  notes?: string;
}

interface AssetRequestItem {
  id: number;
  request_type: string; // new_issue, replacement, repair, return
  title: string;
  description: string;
  category?: string;
  priority?: string; // low, medium, high, urgent
  status: string; // pending, approved, in_progress, resolved, rejected
  employee_name?: string;
  created_at: string;
}

// Zod Schemas matching backend AssetStoreRequest & AssetRequestRequest
const assetSchema = z.object({
  name: z.string().min(2, "Asset name required").max(150, "Max 150 characters"),
  category: z.enum(["laptop", "desktop", "mobile", "monitor", "accessory", "peripheral", "vehicle", "furniture", "other"]),
  brand: z.string().max(80, "Max 80 characters").optional().or(z.literal("")),
  model: z.string().max(80, "Max 80 characters").optional().or(z.literal("")),
  serial_number: z.string().max(100, "Max 100 characters").optional().or(z.literal("")),
  condition_state: z.enum(["new", "good", "fair", "poor", "damaged"]),
  notes: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

type AssetFormData = z.infer<typeof assetSchema>;

const assetRequestSchema = z.object({
  request_type: z.enum(["new_issue", "replacement", "repair", "return"]),
  category: z.enum(["laptop", "desktop", "mobile", "monitor", "accessory", "peripheral", "vehicle", "furniture", "other"]),
  title: z.string().min(3, "Request title must be at least 3 characters").max(200, "Max 200 characters"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  description: z.string().min(5, "Please describe request details").max(1000, "Max 1000 characters"),
});

type AssetRequestFormData = z.infer<typeof assetRequestSchema>;

interface AssetModuleProps {
  isDarkMode?: boolean;
  activeTab?: string;
}

export const AssetModule: React.FC<AssetModuleProps> = ({
  isDarkMode = true,
  activeTab: externalTab = "assets",
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalTab);

  useEffect(() => {
    if (externalTab) setActiveTab(externalTab);
  }, [externalTab]);

  // Data States
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [myAssets, setMyAssets] = useState<AssetItem[]>([]);
  const [loadingMyAssets, setLoadingMyAssets] = useState(false);
  const [requests, setRequests] = useState<AssetRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Form Visibility States
  const [showCreateAsset, setShowCreateAsset] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);

  // Feedback Notification
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showNotify = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Mount Fetching
  useEffect(() => {
    if (activeTab === "assets" || activeTab === "company-assets") fetchAssets();
    if (activeTab === "my-assets") fetchMyAssets();
    if (activeTab === "asset-requests") fetchRequests();
  }, [activeTab]);

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await fetchApi<any>("/assets");
      const list = extractList(res);
      const formatted: AssetItem[] = list.map((item: any) => ({
        id: item.id,
        asset_code: item.asset_code || `AST-${item.id}`,
        category: item.category || "laptop",
        name: item.name || "Company Asset",
        brand: item.brand || "-",
        model: item.model || "-",
        serial_number: item.serial_number || "-",
        status: item.status || "available",
        condition_state: item.condition_state || "good",
        allocated_employee_name: item.allocated_to?.employee_name || item.employee_name || null,
        notes: item.notes || "-",
      }));
      setAssets(formatted);
    } catch {
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const fetchMyAssets = async () => {
    setLoadingMyAssets(true);
    try {
      const res = await fetchApi<any>("/my-assets");
      const list = extractList(res);
      const formatted: AssetItem[] = list.map((item: any) => ({
        id: item.id,
        asset_code: item.asset_code || `AST-${item.id}`,
        category: item.category || "laptop",
        name: item.name || "Assigned Asset",
        brand: item.brand || "-",
        model: item.model || "-",
        serial_number: item.serial_number || "-",
        status: item.status || "allocated",
        condition_state: item.condition_state || "good",
        notes: item.notes || "-",
      }));
      setMyAssets(formatted);
    } catch {
      setMyAssets([]);
    } finally {
      setLoadingMyAssets(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetchApi<any>("/asset-requests");
      const list = extractList(res);
      const formatted: AssetRequestItem[] = list.map((item: any) => ({
        id: item.id,
        request_type: item.request_type || "new_issue",
        title: item.title || "Asset Support Request",
        description: item.description || "-",
        category: item.category || "laptop",
        priority: item.priority || "medium",
        status: item.status || "pending",
        employee_name: item.employee?.user?.name || item.employee_name || "Employee",
        created_at: item.created_at || "-",
      }));
      setRequests(formatted);
    } catch {
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Asset Actions
  const handleReturnAsset = async (assetId: number) => {
    try {
      await fetchApi(`/assets/${assetId}/return`, {
        method: "PUT",
        body: JSON.stringify({ condition: "good", notes: "Returned to IT inventory" }),
      });
      showNotify("Asset returned to available inventory!");
      fetchAssets();
    } catch (err: any) {
      showNotify(err.message || "Failed to return asset", "error");
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    try {
      await fetchApi(`/asset-requests/${requestId}/approve`, {
        method: "PUT",
        body: JSON.stringify({ remarks: "Approved by IT Admin" }),
      });
      showNotify("Asset request approved!");
      fetchRequests();
    } catch (err: any) {
      showNotify(err.message || "Failed to approve request", "error");
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      await fetchApi(`/asset-requests/${requestId}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: "Rejected by IT Admin" }),
      });
      showNotify("Asset request rejected!", "error");
      fetchRequests();
    } catch (err: any) {
      showNotify(err.message || "Failed to reject request", "error");
    }
  };

  // DynamicForm Submit Handlers
  const handleCreateAssetSubmit = async (data: AssetFormData) => {
    try {
      const payload = {
        name: data.name.trim(),
        category: data.category,
        brand: data.brand?.trim() || null,
        model: data.model?.trim() || null,
        serial_number: data.serial_number?.trim() || null,
        condition_state: data.condition_state,
        notes: data.notes?.trim() || null,
      };

      await fetchApi("/assets", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Company asset added to inventory!");
      setShowCreateAsset(false);
      fetchAssets();
    } catch (err: any) {
      showNotify(err.message || "Failed to create asset", "error");
    }
  };

  const handleCreateRequestSubmit = async (data: AssetRequestFormData) => {
    try {
      const payload = {
        request_type: data.request_type,
        category: data.category,
        title: data.title.trim(),
        priority: data.priority,
        description: data.description.trim(),
      };

      await fetchApi("/asset-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotify("Asset request submitted successfully!");
      setShowCreateRequest(false);
      fetchRequests();
    } catch (err: any) {
      showNotify(err.message || "Failed to submit request", "error");
    }
  };

  // DynamicForm Fields Configs
  const assetFields: FieldConfig<AssetFormData>[] = [
    { name: "name", label: "Asset Name", placeholder: "e.g. MacBook Pro M3 Max" },
    {
      name: "category",
      label: "Category",
      type: "select",
      options: [
        { label: "Laptop", value: "laptop" },
        { label: "Desktop", value: "desktop" },
        { label: "Mobile Phone", value: "mobile" },
        { label: "Monitor / Display", value: "monitor" },
        { label: "Accessory / Peripheral", value: "accessory" },
        { label: "Furniture", value: "furniture" },
        { label: "Vehicle", value: "vehicle" },
        { label: "Other Equipment", value: "other" },
      ],
    },
    { name: "brand", label: "Brand / Manufacturer", placeholder: "e.g. Apple" },
    { name: "model", label: "Model Number", placeholder: "e.g. A2992" },
    { name: "serial_number", label: "Serial Number", placeholder: "e.g. C02G1234MD6R" },
    {
      name: "condition_state",
      label: "Initial Condition",
      type: "select",
      options: [
        { label: "Brand New", value: "new" },
        { label: "Good", value: "good" },
        { label: "Fair", value: "fair" },
        { label: "Poor", value: "poor" },
        { label: "Damaged", value: "damaged" },
      ],
    },
    { name: "notes", label: "Asset Notes & Specs", type: "textarea", rows: 2, placeholder: "Additional specs...", colSpan: 2 },
  ];

  const assetRequestFields: FieldConfig<AssetRequestFormData>[] = [
    {
      name: "request_type",
      label: "Request Type",
      type: "select",
      options: [
        { label: "New Asset Issue", value: "new_issue" },
        { label: "Asset Replacement", value: "replacement" },
        { label: "Repair / Maintenance", value: "repair" },
        { label: "Asset Return", value: "return" },
      ],
    },
    {
      name: "category",
      label: "Asset Category",
      type: "select",
      options: [
        { label: "Laptop", value: "laptop" },
        { label: "Desktop", value: "desktop" },
        { label: "Mobile Phone", value: "mobile" },
        { label: "Monitor / Display", value: "monitor" },
        { label: "Accessory", value: "accessory" },
        { label: "Furniture", value: "furniture" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      options: [
        { label: "Low Priority", value: "low" },
        { label: "Medium Priority", value: "medium" },
        { label: "High Priority", value: "high" },
        { label: "Urgent Priority", value: "urgent" },
      ],
    },
    { name: "title", label: "Request Summary Title", placeholder: "e.g. Requesting extra monitor for design work" },
    { name: "description", label: "Justification & Details", type: "textarea", rows: 3, placeholder: "Explain requirement...", colSpan: 2 },
  ];

  // DataTable Column Configurations
  const assetColumns: ColumnDef<AssetItem>[] = useMemo(
    () => [
      {
        accessorKey: "asset_code",
        header: "Asset Tag Code",
        cell: (info) => (
          <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border bg-blue-500/15 text-blue-600 border-blue-500/30">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Asset Name & Model",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <p className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>{row.name}</p>
              <p className={`text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {row.brand} {row.model} (S/N: {row.serial_number})
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: (info) => (
          <span className="font-semibold text-xs text-purple-600 uppercase">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "allocated_employee_name",
        header: "Current Assignee",
        cell: (info) => {
          const name = info.getValue() as string | null;
          return name ? (
            <span className="text-xs font-bold text-emerald-600">{name}</span>
          ) : (
            <span className="text-xs text-slate-400 italic">Unallocated</span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                status === "available"
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : status === "allocated"
                  ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
                  : "bg-rose-500/15 text-rose-600 border-rose-500/30"
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
        cell: (info) => {
          const row = info.row.original;
          if (row.status !== "allocated") return null;
          return (
            <button
              onClick={() => handleReturnAsset(row.id)}
              title="Return Asset to Inventory"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 font-bold text-[10px] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Return</span>
            </button>
          );
        },
      },
    ],
    [isDarkMode]
  );

  const requestColumns: ColumnDef<AssetRequestItem>[] = useMemo(
    () => [
      {
        accessorKey: "request_type",
        header: "Request Type",
        cell: (info) => (
          <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded uppercase border bg-indigo-500/15 text-indigo-600 border-indigo-500/30">
            {(info.getValue() as string).replace("_", " ")}
          </span>
        ),
      },
      {
        accessorKey: "title",
        header: "Title & Details",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <p className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>{row.title}</p>
              <p className={`text-[11px] truncate max-w-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {row.description}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "employee_name",
        header: "Requested By",
        cell: (info) => (
          <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                status === "approved" || status === "resolved"
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : status === "rejected"
                  ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                  : "bg-amber-500/15 text-amber-600 border-amber-500/30"
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
        cell: (info) => {
          const row = info.row.original;
          if (row.status !== "pending") return null;
          return (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleApproveRequest(row.id)}
                title="Approve Request"
                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleRejectRequest(row.id)}
                title="Reject Request"
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [isDarkMode]
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div
        className={`rounded-2xl p-6 border backdrop-blur-xl transition-all duration-300 ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] text-white"
            : "bg-white border-slate-200 text-slate-900 shadow-sm"
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 text-blue-500">
              <Laptop className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Company Assets & Inventory</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-500 border border-blue-500/30">
                  IT & Assets
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Manage hardware inventory, employee allocations, asset returns, and support requests.
              </p>
            </div>
          </div>

          <button
            onClick={() => { setShowCreateAsset(!showCreateAsset); setShowCreateRequest(false); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreateAsset ? "Back to Inventory" : "Add Company Asset"}</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {notification && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                : "bg-rose-500/10 border-rose-500/30 text-rose-500"
            }`}
          >
            {notification.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>{notification.text}</span>
          </div>
        )}
      </div>

      {/* SUB-TABS NAVIGATION BAR */}
      <div className={`flex items-center gap-2 p-1.5 rounded-xl border ${
        isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-200"
      }`}>
        <button
          onClick={() => { setActiveTab("assets"); setShowCreateAsset(false); setShowCreateRequest(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "assets" || activeTab === "company-assets"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Company Assets</span>
        </button>
        <button
          onClick={() => { setActiveTab("my-assets"); setShowCreateAsset(false); setShowCreateRequest(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "my-assets"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>My Allocated Assets</span>
        </button>
        <button
          onClick={() => { setActiveTab("asset-requests"); setShowCreateAsset(false); setShowCreateRequest(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "asset-requests"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Asset Requests</span>
        </button>
      </div>

      {/* SECTION 1: COMPANY ASSETS DIRECTORY */}
      {(activeTab === "assets" || activeTab === "company-assets") && (
        showCreateAsset ? (
          <DynamicForm
            title="Add Company Asset"
            description="Register a new hardware item in company inventory."
            schema={assetSchema}
            fields={assetFields}
            columns={2}
            onSubmit={handleCreateAssetSubmit}
            onCancel={() => setShowCreateAsset(false)}
            submitText="Save Asset"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Company Hardware & Asset Inventory"
            description="Overview of company laptops, displays, mobile devices, and allocations."
            columns={assetColumns}
            data={assets}
            isLoading={loadingAssets}
            searchPlaceholder="Search assets by tag, name, brand, serial..."
            isDarkMode={isDarkMode}
            actionButton={
              <button
                onClick={() => setShowCreateAsset(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Asset</span>
              </button>
            }
          />
        )
      )}

      {/* SECTION 2: MY ALLOCATED ASSETS */}
      {activeTab === "my-assets" && (
        <DataTable
          title="My Allocated Company Assets"
          description="Hardware items currently assigned to your employee account."
          columns={assetColumns}
          data={myAssets}
          isLoading={loadingMyAssets}
          searchPlaceholder="Search my assets by name or serial number..."
          isDarkMode={isDarkMode}
        />
      )}

      {/* SECTION 3: ASSET REQUESTS DIRECTORY */}
      {activeTab === "asset-requests" && (
        showCreateRequest ? (
          <DynamicForm
            title="Raise Asset Support Request"
            description="Request a new asset issue, replacement, or maintenance repair."
            schema={assetRequestSchema}
            fields={assetRequestFields}
            columns={2}
            onSubmit={handleCreateRequestSubmit}
            onCancel={() => setShowCreateRequest(false)}
            submitText="Submit Asset Request"
            isDarkMode={isDarkMode}
          />
        ) : (
          <DataTable
            title="Asset Support Requests Directory"
            description="Employee asset requests for new issues, replacements, and repairs."
            columns={requestColumns}
            data={requests}
            isLoading={loadingRequests}
            searchPlaceholder="Search requests by title or employee..."
            isDarkMode={isDarkMode}
            actionButton={
              <button
                onClick={() => setShowCreateRequest(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Raise Request</span>
              </button>
            }
          />
        )
      )}
    </div>
  );
};
