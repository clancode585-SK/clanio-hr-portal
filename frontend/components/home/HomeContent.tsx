"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ColumnDef } from "@tanstack/react-table";
import Sidebar from "@/components/home/Sidebar";
import Topbar from "@/components/home/Topbar";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { ActionModal } from "@/components/common/ActionModal";
import { fetchApi } from "@/lib/api";
import { getCookie } from "@/lib/cookies";
import { UserPlus, Building, Briefcase, Eye, Pencil, Trash2, ShieldCheck } from "lucide-react";

// ==========================================
// 1. EMPLOYEES DATA & SCHEMAS
// ==========================================
interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;

}

const initialEmployees: Employee[] = [];

const employeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  department: z.string().min(1, "Please select a department"),
  role: z.string().min(2, "Role is required"),

});

type EmployeeFormData = z.infer<typeof employeeSchema>;

// ==========================================
// 2. DEPARTMENTS DATA & SCHEMAS
// ==========================================
interface Department {
  id: string;
  name: string;
  code: string;
  head: string;
  employeesCount: number;
}

const initialDepartments: Department[] = [];

const departmentSchema = z.object({
  name: z.string().min(2, "Department name required").max(150, "Max 150 characters"),
  code: z.string().min(2, "Code required (e.g. OPS)").max(30, "Max 30 characters"),
  description: z.string().max(500, "Max 500 characters").optional(),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface DesignationItem {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  employeesCount: number;
  status: string;
}

const designationSchema = z.object({
  name: z.string().min(2, "Designation name required").max(150, "Max 150 characters"),
  code: z.string().min(2, "Code required (e.g. SR_ENG)").max(30, "Max 30 characters"),
  description: z.string().max(500, "Max 500 characters").optional(),
});

type DesignationFormData = z.infer<typeof designationSchema>;

// ==========================================
// 3. COMPANIES DATA & SCHEMAS
// ==========================================
interface CompanyItem {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  status: string;
}

const initialCompanies: CompanyItem[] = [];

const companySchema = z.object({
  name: z.string().min(2, "Company name required"),
  email: z.string().email("Invalid email address"),
  slug: z.string().min(2, "Slug required"),
  phone: z.string().optional(),
  admin_name: z.string().min(2, "Admin name required"),
  admin_email: z.string().email("Invalid admin email"),
  admin_password: z.string().min(8, "Password must be at least 8 characters"),
});

const companyEditSchema = z.object({
  name: z.string().min(2, "Company name required"),
  email: z.string().email("Invalid email address"),
  slug: z.string().min(2, "Slug required"),
  phone: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

// ==========================================
// 4. BRANCHES DATA & SCHEMAS
// ==========================================
interface BranchItem {
  id: string;
  rawId?: number;
  name: string;
  code: string;
  companyName?: string;
  address?: string;
  phone?: string;
  email?: string;
  usersCount?: number;
  status?: string;
}

const initialBranches: BranchItem[] = [];

const branchSchema = z.object({
  name: z.string().min(2, "Branch name required").max(150, "Max 150 characters"),
  code: z
    .string()
    .min(2, "Branch code required")
    .max(30, "Max 30 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, hyphens or underscores"),
  address: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
  phone: z.string().max(20, "Max 20 characters").optional().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

type BranchFormData = z.infer<typeof branchSchema>;

// ==========================================
// 5. TEAMS DATA & SCHEMAS
// ==========================================
interface TeamItem {
  id: string;
  rawId?: number;
  name: string;
  code: string;
  departmentName?: string;
  department_id?: number;
  description?: string;
  usersCount?: number;
  status?: string;
}

const initialTeams: TeamItem[] = [];

const teamSchema = z.object({
  name: z.string().min(2, "Team name required").max(150, "Max 150 characters"),
  code: z
    .string()
    .min(2, "Team code required")
    .max(30, "Max 30 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, hyphens or underscores"),
  department: z.string().min(1, "Please select a department"),
  description: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

type TeamFormData = z.infer<typeof teamSchema>;

// ==========================================
// 6. ROLES DATA & SCHEMAS
// ==========================================
interface RoleItem {
  id: string;
  rawId?: number;
  name: string;
  slug: string;
  description?: string;
  hierarchy_level?: number;
  data_scope?: string;
  is_system?: boolean;
  is_active?: boolean;
  usersCount?: number;
  permissions?: string[];
}

const roleSchema = z.object({
  name: z.string().min(2, "Role name required").max(100, "Max 100 characters"),
  slug: z
    .string()
    .min(2, "Role slug required")
    .max(100, "Max 100 characters")
    .regex(/^[a-z0-9_]+$/, "Slug must be lowercase alphanumeric with underscores"),
  hierarchy_level: z.coerce.number().min(2, "Level must be between 2 and 99").max(99, "Level must be between 2 and 99"),
  data_scope: z.enum(["all_company", "branch", "department", "team", "self"]),
  description: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function HomeContent() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getCookie("token") || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    const auth = getCookie("isAuthenticated") === "true" || (typeof window !== "undefined" && localStorage.getItem("isAuthenticated") === "true");

    if (!token && !auth) {
      router.replace("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeNav, setActiveNav] = useState("employees");
  const [userName, setUserName] = useState("Platform Super Admin");

  // Restore active navigation tab from URL params or localStorage on refresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const savedTab = localStorage.getItem("activeNav");
      if (tabParam) {
        setActiveNav(tabParam);
      } else if (savedTab) {
        setActiveNav(savedTab);
      }
    }
  }, []);

  const handleNavChange = (navId: string) => {
    setActiveNav(navId);
    if (typeof window !== "undefined") {
      localStorage.setItem("activeNav", navId);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", navId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const [companyName, setCompanyName] = useState("Clanio HR");
  const [viewMode, setViewMode] = useState<"admin" | "employee">("admin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMode = localStorage.getItem("view_mode") as "admin" | "employee";
      if (storedMode === "admin" || storedMode === "employee") {
        setViewMode(storedMode);
      }
    }
  }, []);

  const handleToggleViewMode = (mode: "admin" | "employee") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("view_mode", mode);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("user_name");
      const isSuper = localStorage.getItem("is_super_admin") === "true";
      const storedEmail = localStorage.getItem("user_email");
      const storedCompany = localStorage.getItem("company_name");

      if (storedName) {
        setUserName(storedName);
      } else if (isSuper || storedEmail === "superadmin@clanio.com") {
        setUserName("Platform Super Admin");
      }

      if (storedCompany) {
        setCompanyName(storedCompany);
      }
    }
  }, []);

  // State for Employees View
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [showAddEmpForm, setShowAddEmpForm] = useState(false);

  // State for Departments View
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [showAddDeptForm, setShowAddDeptForm] = useState(false);

  // State for Companies View
  const [companies, setCompanies] = useState<CompanyItem[]>(initialCompanies);
  const [showAddCompanyForm, setShowAddCompanyForm] = useState(false);

  // State for Designations View
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [showAddDesignationForm, setShowAddDesignationForm] = useState(false);

  // State for Branches View
  const [branches, setBranches] = useState<BranchItem[]>(initialBranches);
  const [showAddBranchForm, setShowAddBranchForm] = useState(false);

  // State for Teams View
  const [teams, setTeams] = useState<TeamItem[]>(initialTeams);
  const [showAddTeamForm, setShowAddTeamForm] = useState(false);

  // State for Roles View
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [showAddRoleForm, setShowAddRoleForm] = useState(false);

  // Unified Action Modal State
  type ActionType = "view" | "edit" | "delete" | null;
  type EntityType = "employees" | "departments" | "designations" | "companies" | "branches" | "teams" | "roles";

  const [actionState, setActionState] = useState<{
    type: ActionType;
    entity: EntityType;
    data: any | null;
  }>({
    type: null,
    entity: "employees",
    data: null,
  });

  const handleViewDetails = async (item: any, entity: EntityType) => {
    const rawId = item.rawId || item.id;
    try {
      const res = await fetchApi<any>(`/${entity}/${rawId}`);
      const fullData = res?.data || res;
      setActionState({ type: "view", entity, data: fullData });
    } catch {
      setActionState({ type: "view", entity, data: item });
    }
  };

  const handleDeleteRecord = async (item: any) => {
    const { entity } = actionState;
    const rawId = item.rawId || item.id;
    try {
      await fetchApi(`/${entity}/${rawId}`, { method: "DELETE" });
      if (entity === "employees") fetchEmployeesData();
      if (entity === "departments") fetchDepartmentsData();
      if (entity === "designations") fetchDesignationsData();
      if (entity === "companies") fetchCompaniesData();
      if (entity === "branches") fetchBranchesData();
      if (entity === "teams") fetchTeamsData();
      if (entity === "roles") fetchRolesData();
    } catch (error: any) {
      console.error("Delete failed:", error);
      throw error;
    }
  };

  const handleEditRecord = async (updatedData: any) => {
    const { entity, data } = actionState;
    const rawId = data.rawId || data.id;

    try {
      let payload: any = {};
      if (entity === "employees") {
        const selectedDept = departments.find(
          (d) => d.name === updatedData.department || String(d.id) === updatedData.department
        );
        const deptId = selectedDept && !isNaN(Number((selectedDept as any).rawId || selectedDept.id))
          ? Number((selectedDept as any).rawId || selectedDept.id)
          : null;

        const selectedDesig = designations.find(
          (d) => d.name === updatedData.role || String(d.id) === updatedData.role
        );
        const desigId = selectedDesig && !isNaN(Number((selectedDesig as any).rawId || selectedDesig.id))
          ? Number((selectedDesig as any).rawId || selectedDesig.id)
          : null;

        payload = {
          personal_email: updatedData.email,
          ...(desigId ? { designation_id: desigId } : {}),
          user: {
            name: updatedData.name,
            email: updatedData.email,
            ...(deptId ? { department_id: deptId } : {}),
          },
        };
      } else if (entity === "departments" || entity === "designations") {
        payload = {
          name: updatedData.name,
          code: updatedData.code,
          description: updatedData.description || null,
        };
      } else if (entity === "companies") {
        payload = {
          name: updatedData.name,
          slug: updatedData.slug,
          email: updatedData.email,
          phone: updatedData.phone || null,
        };
      } else if (entity === "branches") {
        payload = {
          name: updatedData.name,
          code: updatedData.code,
          address: updatedData.address || null,
          phone: updatedData.phone || null,
          email: updatedData.email || null,
        };
      } else if (entity === "teams") {
        const selectedDept = departments.find(
          (d) => d.name === updatedData.department || String(d.id) === updatedData.department
        );
        const deptId = selectedDept && !isNaN(Number((selectedDept as any).rawId || selectedDept.id))
          ? Number((selectedDept as any).rawId || selectedDept.id)
          : Number(updatedData.department_id || 1);

        payload = {
          name: updatedData.name,
          code: updatedData.code,
          department_id: deptId,
          description: updatedData.description || null,
        };
      } else if (entity === "roles") {
        payload = {
          name: updatedData.name,
          slug: updatedData.slug,
          hierarchy_level: Number(updatedData.hierarchy_level),
          data_scope: updatedData.data_scope,
          description: updatedData.description || null,
          permissions: ["employee.view", "branch.view", "department.view"],
        };
      }

      await fetchApi(`/${entity}/${rawId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (entity === "employees") fetchEmployeesData();
      if (entity === "departments") fetchDepartmentsData();
      if (entity === "designations") fetchDesignationsData();
      if (entity === "companies") fetchCompaniesData();
      if (entity === "branches") fetchBranchesData();
      if (entity === "teams") fetchTeamsData();
      if (entity === "roles") fetchRolesData();
    } catch (error: any) {
      console.error("Update failed:", error);
      alert(error.message || `Failed to update ${entity}.`);
    }
  };

  const renderActionButtons = (item: any, entity: EntityType) => (
    <div className="flex items-center gap-1.5">
      <button
        title="View Details"
        onClick={() => handleViewDetails(item, entity)}
        className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
          isDarkMode
            ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white"
            : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 hover:text-slate-900"
        }`}
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
      <button
        title="Edit"
        onClick={() => setActionState({ type: "edit", entity, data: item })}
        className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
          isDarkMode
            ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30 hover:text-blue-300"
            : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 hover:text-blue-700"
        }`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        title="Delete"
        onClick={() => setActionState({ type: "delete", entity, data: item })}
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

  const fetchCompaniesData = async () => {
    try {
      const res = await fetchApi<any>("/companies");
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      const formattedCompanies: CompanyItem[] = list.map((item: any) => ({
        rawId: item.id,
        id: item.uuid || String(item.id),
        name: item.name || "Company",
        slug: item.slug || item.name?.toLowerCase().replace(/\s+/g, "-") || "company",
        email: item.email || "contact@company.com",
        phone: item.phone || "-",
        status: item.status || "active",
      }));
      setCompanies(formattedCompanies);
    } catch (err) {
      console.warn("Could not fetch real companies:", err);
      setCompanies([]);
    }
  };

  // Fetch real designation data from backend API
  const fetchDesignationsData = async () => {
    try {
      const res = await fetchApi<any>("/designations");
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];

      const formattedDesignations: DesignationItem[] = list.map((item: any) => ({
        rawId: item.id,
        id: item.id ? String(item.id) : `DESIG-${item.code}`,
        name: item.name || "Designation",
        code: item.code || "DESIG",
        departmentName: item.department?.name || "-",
        employeesCount: item.employees_count ?? 0,
        status: item.status || "active",
      }));
      setDesignations(formattedDesignations);
    } catch (err) {
      console.warn("Could not fetch real designations from backend:", err);
      setDesignations([]);
    }
  };

  // Fetch real employee data from backend API
  const fetchEmployeesData = async () => {
    try {
      const res = await fetchApi<any>("/employees");
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];

      const formattedEmployees: Employee[] = list.map((item: any) => ({
        rawId: item.id,
        id:
          item.employee_code ||
          (item.id ? `EMP-${String(item.id).padStart(3, "0")}` : "EMP-001"),
        name:
          item.user?.name ||
          item.name ||
          item.emergency_contact_name ||
          "Employee",
        email:
          item.user?.email ||
          item.personal_email ||
          item.email ||
          "employee@clanoid.com",
        department:
          item.user?.department?.name ||
          item.department?.name ||
          (typeof item.department === "string" ? item.department : null) ||
          "-",
        role:
          item.designation?.name ||
          item.user?.roles?.[0]?.name ||
          (typeof item.role === "string" ? item.role : null) ||
          "-",
      }));
      setEmployees(formattedEmployees);
    } catch (err) {
      console.warn("Could not fetch real employees from backend:", err);
      setEmployees([]);
    }
  };

  // Fetch real department data from backend API
  const fetchDepartmentsData = async () => {
    try {
      const res = await fetchApi<any>("/departments");
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];

      const formattedDepartments: Department[] = list.map((item: any) => ({
        rawId: item.id,
        id: item.id ? String(item.id) : `DEPT-${item.code}`,
        name: item.name || "Department",
        code: item.code || "DEPT",
        head: item.head || "Department Head",
        employeesCount: item.users_count ?? item.employeesCount ?? 0,
      }));
      setDepartments(formattedDepartments);
    } catch (err) {
      console.warn("Could not fetch real departments from backend:", err);
      setDepartments([]);
    }
  };

  // Fetch real branch data from backend API
  const fetchBranchesData = async () => {
    try {
      const res = await fetchApi<any>("/branches");
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];

      const formattedBranches: BranchItem[] = list.map((item: any) => ({
        rawId: item.id,
        id: item.id ? String(item.id) : `BRANCH-${item.code}`,
        name: item.name || "Branch",
        code: item.code || "BRANCH",
        companyName: item.company_name || item.company?.name || "-",
        address: item.address || "-",
        phone: item.phone || "-",
        email: item.email || "-",
        usersCount: item.users_count ?? 0,
        status: item.status || "active",
      }));
      setBranches(formattedBranches);
    } catch (err) {
      console.warn("Could not fetch real branches from backend:", err);
      setBranches([]);
    }
  };

  // Fetch real team data from backend API
  const fetchTeamsData = async () => {
    try {
      const res = await fetchApi<any>("/teams");
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];

      const formattedTeams: TeamItem[] = list.map((item: any) => ({
        rawId: item.id,
        id: item.id ? String(item.id) : `TEAM-${item.code}`,
        name: item.name || "Team",
        code: item.code || "TEAM",
        departmentName: item.department?.name || "-",
        department_id: item.department_id || item.department?.id,
        description: item.description || "-",
        usersCount: item.users_count ?? 0,
        status: item.status || "active",
      }));
      setTeams(formattedTeams);
    } catch (err) {
      console.warn("Could not fetch real teams from backend:", err);
      setTeams([]);
    }
  };

  // Fetch real role data from backend API
  const fetchRolesData = async () => {
    try {
      const res = await fetchApi<any>("/roles");
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];

      const formattedRoles: RoleItem[] = list.map((item: any) => ({
        rawId: item.id,
        id: item.id ? String(item.id) : `ROLE-${item.slug}`,
        name: item.name || "Role",
        slug: item.slug || "role",
        description: item.description || "-",
        hierarchy_level: item.hierarchy_level ?? 99,
        data_scope: item.data_scope || "self",
        is_system: item.is_system ?? false,
        is_active: item.is_active ?? true,
        usersCount: item.users_count ?? 0,
        permissions: Array.isArray(item.permissions)
          ? item.permissions.map((p: any) => p.slug || p)
          : [],
      }));
      setRoles(formattedRoles);
    } catch (err) {
      console.warn("Could not fetch real roles from backend:", err);
      setRoles([]);
    }
  };

  // Sync with Laravel Backend API when nav items are selected
  useEffect(() => {
    fetchDepartmentsData();
    fetchDesignationsData();
    if (activeNav === "employees") {
      fetchEmployeesData();
    }
    if (activeNav === "companies") {
      fetchCompaniesData();
    }
    if (activeNav === "branches") {
      fetchBranchesData();
    }
    if (activeNav === "teams") {
      fetchTeamsData();
    }
    if (activeNav === "roles") {
      fetchRolesData();
    }
  }, [activeNav]);

  // Column Configurations
  const employeeColumns: ColumnDef<Employee>[] = [
    {
      accessorKey: "id",
      header: "Employee ID",
      cell: (info) => (
        <span
          className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border shadow-2xs ${isDarkMode
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
                className={`w-full h-full rounded-full flex items-center justify-center text-[10px] font-extrabold ${isDarkMode ? "bg-[#081425] text-white" : "bg-white text-slate-900"
                  }`}
              >
                {initials}
              </div>
            </div>
            <span
              className={`font-bold text-xs sm:text-sm ${isDarkMode ? "text-white" : "text-slate-900"
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
          className={`text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-600"
            }`}
        >
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: (info) => {
        const dept = info.getValue() as string;
        const colorClass =
          dept === "Engineering"
            ? isDarkMode
              ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
              : "bg-cyan-50 text-cyan-700 border-cyan-200"
            : dept === "Human Resources"
              ? isDarkMode
                ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                : "bg-purple-50 text-purple-700 border-purple-200"
              : dept === "Marketing"
                ? isDarkMode
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                : isDarkMode
                  ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                  : "bg-blue-50 text-blue-700 border-blue-200";

        return (
          <span
            className={``}
          >
            {dept}
          </span>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Designation",
      cell: (info) => (
        <span
          className={`font-semibold text-xs ${isDarkMode ? "text-slate-200" : "text-slate-800"
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
      cell: (info) => renderActionButtons(info.row.original, "employees"),
    },
  ];

  const departmentColumns: ColumnDef<Department>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: (info) => (
        <span
          className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${isDarkMode
            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
            : "bg-indigo-50 text-indigo-700 border-indigo-200"
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
          className={`font-bold text-xs sm:text-sm ${isDarkMode ? "text-white" : "text-slate-900"
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
          className={`text-xs font-semibold ${isDarkMode ? "text-cyan-300" : "text-indigo-600"
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
          className={`font-semibold text-xs px-2.5 py-1 rounded-full border ${isDarkMode
            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
            : "bg-purple-50 text-purple-700 border-purple-200"
            }`}
        >
          {info.getValue() as number} employees
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: (info) => renderActionButtons(info.row.original, "departments"),
    },
  ];

  // Dynamic Department options for company user form
  const departmentOptions = departments.length > 0
    ? departments.map((d) => ({ label: d.name, value: String((d as any).rawId || d.id) }))
    : [{ label: "No departments available", value: "" }];

  // Dynamic Designation options for company user form
  const designationOptions = designations.length > 0
    ? designations.map((d) => ({ label: d.name, value: d.name }))
    : [{ label: "No designations available", value: "" }];

  // Form Fields Configs
  const employeeFields: FieldConfig<EmployeeFormData>[] = [
    { name: "name", label: "Full Name", placeholder: "e.g. John Doe" },
    { name: "email", label: "Email Address", type: "email", placeholder: "john@clanoid.com" },
    {
      name: "department",
      label: "Department",
      type: "select",
      options: departmentOptions,
    },
    {
      name: "role",
      label: "Designation / Role",
      type: "select",
      options: designationOptions,
    },
  ];

  const departmentFields: FieldConfig<DepartmentFormData>[] = [
    { name: "name", label: "Department Name", placeholder: "e.g. Operations & Logistics" },
    { name: "code", label: "Department Code", placeholder: "e.g. OPS" },
    { name: "description", label: "Description (Optional)", placeholder: "Brief description of department..." },
  ];

  const companyColumns: ColumnDef<CompanyItem>[] = [
    {
      accessorKey: "name",
      header: "Company Name",
      cell: (info) => (
        <span
          className={`font-bold text-xs sm:text-sm ${isDarkMode ? "text-white" : "text-slate-900"
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
          className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border ${isDarkMode
            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
            : "bg-purple-50 text-purple-700 border-purple-200"
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
          className={`text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-600"
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
            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${status === "active"
              ? isDarkMode
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
              : isDarkMode
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
      cell: (info) => renderActionButtons(info.row.original, "designations"),
    },
  ];

  const designationColumns: ColumnDef<DesignationItem>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: (info) => (
        <span
          className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${isDarkMode
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
          className={`font-bold text-xs sm:text-sm ${isDarkMode ? "text-white" : "text-slate-900"
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
          className={`text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-600"
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
          className={`font-semibold text-xs px-2.5 py-1 rounded-full border ${isDarkMode
            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
            : "bg-indigo-50 text-indigo-700 border-indigo-200"
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
            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${status === "active"
              ? isDarkMode
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
              : isDarkMode
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
      cell: (info) => renderActionButtons(info.row.original, "companies"),
    },
  ];

  const designationFields: FieldConfig<DesignationFormData>[] = [
    { name: "name", label: "Designation Name", placeholder: "e.g. Senior Full Stack Engineer" },
    { name: "code", label: "Designation Code", placeholder: "e.g. SR_ENG" },
    { name: "description", label: "Description (Optional)", placeholder: "Brief description of role..." },
  ];

  const handleAddDesignation = async (data: DesignationFormData) => {
    try {
      const payload = {
        name: data.name,
        code: data.code,
        description: data.description || null,
      };

      await fetchApi<DesignationItem>("/designations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      fetchDesignationsData();
      setShowAddDesignationForm(false);
    } catch (error: any) {
      console.error("Error creating designation:", error);
      alert(error.message || "Failed to create designation.");
    }
  };

  const companyFields: FieldConfig<CompanyFormData>[] = [
    { name: "name", label: "Company Name", placeholder: "e.g. Acme Technologies" },
    { name: "email", label: "Company Email", type: "email", placeholder: "contact@acme.com" },
    { name: "slug", label: "Company Slug", placeholder: "e.g. acme-technologies" },
    { name: "phone", label: "Phone Number", placeholder: "e.g. +91 9876543210" },
    { name: "admin_name", label: "Company Admin Name", placeholder: "e.g. John Administrator" },
    { name: "admin_email", label: "Company Admin Email", type: "email", placeholder: "admin@acme.com" },
    { name: "admin_password", label: "Company Admin Password", type: "password", placeholder: "Password123" },
  ];

  const companyEditFields: FieldConfig<any>[] = [
    { name: "name", label: "Company Name", placeholder: "e.g. Acme Technologies" },
    { name: "email", label: "Company Email", type: "email", placeholder: "contact@acme.com" },
    { name: "slug", label: "Company Slug", placeholder: "e.g. acme-technologies" },
    { name: "phone", label: "Phone Number", placeholder: "e.g. +91 9876543210" },
  ];

  const branchColumns: ColumnDef<BranchItem>[] = [
    {
      accessorKey: "code",
      header: "Branch Code",
      cell: (info) => (
        <span
          className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${isDarkMode
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
          className={`font-bold text-xs sm:text-sm ${isDarkMode ? "text-white" : "text-slate-900"
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
          className={`font-semibold text-xs px-2.5 py-1 rounded-lg border ${isDarkMode
            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
            : "bg-purple-50 text-purple-700 border-purple-200"
            }`}
        >
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: (info) => (
        <span
          className={`text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-600"
            }`}
        >
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: (info) => (
        <span
          className={`text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-600"
            }`}
        >
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: (info) => (
        <span
          className={`text-xs truncate max-w-[200px] block ${isDarkMode ? "text-slate-400" : "text-slate-500"
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
          className={`font-semibold text-xs px-2.5 py-1 rounded-full border ${isDarkMode
            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
            : "bg-purple-50 text-purple-700 border-purple-200"
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
      cell: (info) => renderActionButtons(info.row.original, "branches"),
    },
  ];

  const branchFields: FieldConfig<BranchFormData>[] = [
    { name: "name", label: "Branch Name", placeholder: "e.g. Delhi Regional Office" },
    { name: "code", label: "Branch Code", placeholder: "e.g. DEL-HQ" },
    { name: "email", label: "Email Address (Optional)", type: "email", placeholder: "branch@clanio.com" },
    { name: "phone", label: "Phone Number (Optional)", placeholder: "+91 98765 43210" },
    { name: "address", label: "Address (Optional)", placeholder: "Full office address..." },
  ];

  const handleAddBranch = async (data: BranchFormData) => {
    try {
      const payload = {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        status: "active",
      };

      await fetchApi<any>("/branches", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowAddBranchForm(false);
      fetchBranchesData();
    } catch (error: any) {
      console.error("Failed to create branch:", error);
      alert(error.message || "Failed to create branch.");
    }
  };

  const teamColumns: ColumnDef<TeamItem>[] = [
    {
      accessorKey: "code",
      header: "Team Code",
      cell: (info) => (
        <span
          className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${isDarkMode
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
          className={`font-bold text-xs sm:text-sm ${isDarkMode ? "text-white" : "text-slate-900"
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
          className={`font-semibold text-xs px-2.5 py-1 rounded-lg border ${isDarkMode
            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            : "bg-cyan-50 text-cyan-700 border-cyan-200"
            }`}
        >
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: (info) => (
        <span
          className={`text-xs truncate max-w-[200px] block ${isDarkMode ? "text-slate-400" : "text-slate-500"
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
          className={`font-semibold text-xs px-2.5 py-1 rounded-full border ${isDarkMode
            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
            : "bg-indigo-50 text-indigo-700 border-indigo-200"
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
      cell: (info) => renderActionButtons(info.row.original, "teams"),
    },
  ];

  const teamFields: FieldConfig<TeamFormData>[] = [
    { name: "name", label: "Team Name", placeholder: "e.g. Frontend Engineering" },
    { name: "code", label: "Team Code", placeholder: "e.g. ENG-FE" },
    {
      name: "department",
      label: "Department",
      type: "select",
      options: departmentOptions,
    },
    { name: "description", label: "Description (Optional)", placeholder: "Brief description of team..." },
  ];

  const roleColumns: ColumnDef<RoleItem>[] = [
    {
      accessorKey: "slug",
      header: "Role Slug",
      cell: (info) => (
        <span
          className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border ${isDarkMode
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
          className={`font-bold text-xs sm:text-sm ${isDarkMode ? "text-white" : "text-slate-900"
            }`}
        >
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "hierarchy_level",
      header: "Level",
      cell: (info) => (
        <span
          className={`font-mono font-bold text-xs px-2.5 py-1 rounded-full border ${isDarkMode
            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
            : "bg-purple-50 text-purple-700 border-purple-200"
            }`}
        >
          Level {info.getValue() as number}
        </span>
      ),
    },
    {
      accessorKey: "data_scope",
      header: "Data Scope",
      cell: (info) => (
        <span
          className={`font-semibold text-xs px-2.5 py-1 rounded-lg border capitalize ${isDarkMode
            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            : "bg-cyan-50 text-cyan-700 border-cyan-200"
            }`}
        >
          {((info.getValue() as string) || "self").replace(/_/g, " ")}
        </span>
      ),
    },
    {
      accessorKey: "usersCount",
      header: "Assigned Users",
      cell: (info) => (
        <span
          className={`font-semibold text-xs px-2.5 py-1 rounded-full border ${isDarkMode
            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
        >
          {info.getValue() as number} users
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: (info) => renderActionButtons(info.row.original, "roles"),
    },
  ];

  const roleFields: FieldConfig<RoleFormData>[] = [
    { name: "name", label: "Role Name", placeholder: "e.g. HR Specialist" },
    { name: "slug", label: "Role Slug", placeholder: "e.g. hr_specialist" },
    { name: "hierarchy_level", label: "Hierarchy Level (2-99)", type: "number", placeholder: "e.g. 5" },
    {
      name: "data_scope",
      label: "Data Scope Access",
      type: "select",
      options: [
        { label: "All Company", value: "all_company" },
        { label: "Branch Only", value: "branch" },
        { label: "Department Only", value: "department" },
        { label: "Team Only", value: "team" },
        { label: "Self Only", value: "self" },
      ],
    },
    { name: "description", label: "Description (Optional)", placeholder: "Role responsibilities..." },
  ];

  const handleAddRole = async (data: RoleFormData) => {
    try {
      const payload = {
        name: data.name.trim(),
        slug: data.slug.trim().toLowerCase(),
        hierarchy_level: Number(data.hierarchy_level),
        data_scope: data.data_scope,
        description: data.description?.trim() || null,
        is_active: true,
        permissions: ["employee.view", "branch.view", "department.view"],
      };

      await fetchApi<any>("/roles", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowAddRoleForm(false);
      fetchRolesData();
    } catch (error: any) {
      console.error("Failed to create role:", error);
      alert(error.message || "Failed to create role.");
    }
  };

  const handleAddTeam = async (data: TeamFormData) => {
    try {
      const selectedDept = departments.find(
        (d) => String((d as any).rawId || d.id) === data.department || d.name === data.department
      );
      const deptId = selectedDept && !isNaN(Number((selectedDept as any).rawId || selectedDept.id))
        ? Number((selectedDept as any).rawId || selectedDept.id)
        : !isNaN(Number(data.department))
          ? Number(data.department)
          : departments[0] && !isNaN(Number((departments[0] as any).rawId || departments[0].id))
            ? Number((departments[0] as any).rawId || departments[0].id)
            : 1;

      const payload = {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        department_id: deptId,
        description: data.description?.trim() || null,
        status: "active",
      };

      await fetchApi<any>("/teams", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowAddTeamForm(false);
      fetchTeamsData();
    } catch (error: any) {
      console.error("Failed to create team:", error);
      alert(error.message || "Failed to create team.");
    }
  };

  // Add Record Handlers (Connected to Laravel API with local fallback)
  const handleAddCompany = async (data: CompanyFormData) => {
    try {
      const payload = {
        name: data.name,
        slug: data.slug,
        email: data.email,
        phone: data.phone || null,
        admin: {
          name: data.admin_name,
          email: data.admin_email,
          password: data.admin_password,
        },
      };

      await fetchApi<CompanyItem>("/companies", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      fetchCompaniesData();
      setShowAddCompanyForm(false);
    } catch (error: any) {
      console.error("Error creating company:", error);
      alert(error.message || "Failed to create company.");
    }
  };

  // Add Record Handlers (Connected to Laravel API with local fallback)
  const handleAddEmployee = async (data: EmployeeFormData) => {
    try {
      const selectedDept = departments.find(
        (d) => d.name === data.department || String(d.id) === data.department
      );
      const deptId = selectedDept && !isNaN(Number(selectedDept.id)) ? Number(selectedDept.id) : null;

      const selectedDesig = designations.find(
        (d) => d.name === data.role || String(d.id) === data.role
      );
      const desigId = selectedDesig && !isNaN(Number(selectedDesig.id)) ? Number(selectedDesig.id) : null;

      const payload = {
        date_of_joining: new Date().toISOString().split("T")[0],
        personal_email: data.email,
        ...(desigId ? { designation_id: desigId } : {}),
        user: {
          name: data.name,
          email: data.email,
          password: "Password123",
          ...(deptId ? { department_id: deptId } : {}),
        },
      };

      await fetchApi<Employee>("/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      fetchEmployeesData();
      setShowAddEmpForm(false);
    } catch (error: any) {
      console.error("Error creating employee:", error);
      alert(error.message || "Failed to create employee.");
    }
  };

  const handleAddDepartment = async (data: DepartmentFormData) => {
    try {
      const payload = {
        name: data.name,
        code: data.code,
        description: data.description || null,
      };

      await fetchApi<Department>("/departments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      fetchDepartmentsData();
      setShowAddDeptForm(false);
    } catch (error: any) {
      console.error("Error creating department:", error);
      alert(error.message || "Failed to create department.");
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-900 overflow-hidden">
      {/* Left Sidebar Component - Always kept dark */}
      <Sidebar
        isCollapsed={!isSidebarOpen}
        isDarkMode={true}
        activeItem={activeNav}
        onSelectItem={handleNavChange}
        viewMode={viewMode}
      />

      {/* Main Layout Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? "bg-[#071326]" : "bg-slate-100"
          }`}
      >
        {/* Top Navigation Bar Component - Always kept dark */}
        <Topbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isDarkMode={true}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
          onSelectItem={handleNavChange}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
        />

        {/* Dashboard Main Workspace Area */}
        <main
          className={`flex-1 p-6 sm:p-8 overflow-y-auto relative transition-colors duration-300 ${isDarkMode ? "bg-[#071326] text-white" : "bg-slate-100/90 text-slate-900"
            }`}
        >
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Title Section */}
            <div className="space-y-1.5 pb-1">
              <div className="flex items-center gap-3">
                <h1
                  className={`text-2xl sm:text-3xl font-black tracking-tight leading-none capitalize ${isDarkMode
                    ? "text-white"
                    : "bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 bg-clip-text text-transparent"
                    }`}
                >
                  {activeNav.replace("-", " ")}
                </h1>
                <span
                  className={`text-xs font-extrabold px-3 py-1 rounded-full border shrink-0 shadow-2xs ${
                    viewMode === "admin"
                      ? isDarkMode
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        : "bg-blue-50 text-blue-800 border-blue-200"
                      : isDarkMode
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  {viewMode === "admin" ? "🛡️ Admin Mode" : "👤 Employee Mode"}
                </span>
              </div>

              <div
                className={`text-xs sm:text-sm font-medium flex flex-wrap items-center gap-2 pt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
              >
                <span>
                  Logged in as{" "}
                  <strong className={isDarkMode ? "text-slate-200" : "text-slate-800"}>
                    {userName}
                  </strong>
                </span>
                <span className={isDarkMode ? "text-slate-600" : "text-slate-300"}>•</span>
                <span className={`font-semibold ${isDarkMode ? "text-cyan-300" : "text-indigo-600"}`}>
                  {companyName}
                </span>
              </div>
            </div>

            {/* DYNAMIC SIDEBAR SECTION VIEW */}
            {activeNav === "companies" ? (
              showAddCompanyForm ? (
                <DynamicForm
                  title="Add New Company"
                  description="Register a new organization on CLANIO Platform."
                  schema={companySchema}
                  fields={companyFields}
                  columns={2}
                  onSubmit={handleAddCompany}
                  onCancel={() => setShowAddCompanyForm(false)}
                  submitText="Create Company"
                  isDarkMode={isDarkMode}
                />
              ) : (
                <DataTable
                  title="Companies Directory"
                  description="Manage registered companies and workspace accounts."
                  columns={companyColumns}
                  data={companies}
                  searchPlaceholder="Search companies by name, email or slug..."
                  isDarkMode={isDarkMode}
                  actionButton={
                    <button
                      onClick={() => setShowAddCompanyForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <Building className="w-4 h-4" />
                      <span>Add Company</span>
                    </button>
                  }
                />
              )
            ) : activeNav === "employees" ? (
              showAddEmpForm ? (
                <DynamicForm
                  title="Add New Employee"
                  description="Fill in employee details to create a new profile."
                  schema={employeeSchema}
                  fields={employeeFields}
                  columns={2}
                  onSubmit={handleAddEmployee}
                  onCancel={() => setShowAddEmpForm(false)}
                  submitText="Create Employee"
                  isDarkMode={isDarkMode}
                />
              ) : (
                <DataTable
                  title="Employee Directory"
                  description="Manage all active and inactive employees across departments."
                  columns={employeeColumns}
                  data={employees}
                  searchPlaceholder="Search employees by name, email or role..."
                  isDarkMode={isDarkMode}
                  actionButton={
                    <button
                      onClick={() => setShowAddEmpForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add Employee</span>
                    </button>
                  }
                />
              )
            ) : activeNav === "departments" ? (
              showAddDeptForm ? (
                <DynamicForm
                  title="Add New Department"
                  description="Define a new organizational department."
                  schema={departmentSchema}
                  fields={departmentFields}
                  columns={2}
                  onSubmit={handleAddDepartment}
                  onCancel={() => setShowAddDeptForm(false)}
                  submitText="Create Department"
                  isDarkMode={isDarkMode}
                />
              ) : (
                <DataTable
                  title="Departments Overview"
                  description="Organizational units and their leaders."
                  columns={departmentColumns}
                  data={departments}
                  searchPlaceholder="Search departments..."
                  isDarkMode={isDarkMode}
                  actionButton={
                    <button
                      onClick={() => setShowAddDeptForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <Building className="w-4 h-4" />
                      <span>Add Department</span>
                    </button>
                  }
                />
              )
            ) : activeNav === "designations" ? (
              showAddDesignationForm ? (
                <DynamicForm
                  title="Add New Designation"
                  description="Define a new designation title and role."
                  schema={designationSchema}
                  fields={designationFields}
                  columns={2}
                  onSubmit={handleAddDesignation}
                  onCancel={() => setShowAddDesignationForm(false)}
                  submitText="Create Designation"
                  isDarkMode={isDarkMode}
                />
              ) : (
                <DataTable
                  title="Designations Directory"
                  description="Manage designations and job titles across departments."
                  columns={designationColumns}
                  data={designations}
                  searchPlaceholder="Search designations by name, code..."
                  isDarkMode={isDarkMode}
                  actionButton={
                    <button
                      onClick={() => setShowAddDesignationForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <Briefcase className="w-4 h-4" />
                      <span>Add Designation</span>
                    </button>
                  }
                />
              )
            ) : activeNav === "branches" ? (
              showAddBranchForm ? (
                <DynamicForm
                  title="Add New Branch Location"
                  description="Register a new office branch or regional headquarters."
                  schema={branchSchema}
                  fields={branchFields}
                  columns={2}
                  onSubmit={handleAddBranch}
                  onCancel={() => setShowAddBranchForm(false)}
                  submitText="Create Branch"
                  isDarkMode={isDarkMode}
                />
              ) : (
                <DataTable
                  title="Branch Locations Directory"
                  description="Manage company offices and regional branch locations."
                  columns={branchColumns}
                  data={branches}
                  searchPlaceholder="Search branches by name, code or address..."
                  isDarkMode={isDarkMode}
                  actionButton={
                    <button
                      onClick={() => setShowAddBranchForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <Building className="w-4 h-4" />
                      <span>Add Branch</span>
                    </button>
                  }
                />
              )
            ) : activeNav === "teams" ? (
              showAddTeamForm ? (
                <DynamicForm
                  title="Add New Team"
                  description="Form a new project or functional team."
                  schema={teamSchema}
                  fields={teamFields}
                  columns={2}
                  onSubmit={handleAddTeam}
                  onCancel={() => setShowAddTeamForm(false)}
                  submitText="Create Team"
                  isDarkMode={isDarkMode}
                />
              ) : (
                <DataTable
                  title="Teams Directory"
                  description="Functional units and project teams within departments."
                  columns={teamColumns}
                  data={teams}
                  searchPlaceholder="Search teams by name, code or department..."
                  isDarkMode={isDarkMode}
                  actionButton={
                    <button
                      onClick={() => setShowAddTeamForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <Briefcase className="w-4 h-4" />
                      <span>Add Team</span>
                    </button>
                  }
                />
              )
            ) : activeNav === "roles" ? (
              showAddRoleForm ? (
                <DynamicForm
                  title="Add New User Role"
                  description="Define custom roles and access scope hierarchy."
                  schema={roleSchema}
                  fields={roleFields}
                  columns={2}
                  onSubmit={handleAddRole}
                  onCancel={() => setShowAddRoleForm(false)}
                  submitText="Create Role"
                  isDarkMode={isDarkMode}
                />
              ) : (
                <DataTable
                  title="System Roles & Permissions"
                  description="Manage organizational roles, hierarchy levels, and access scopes."
                  columns={roleColumns}
                  data={roles}
                  searchPlaceholder="Search roles by name, slug or data scope..."
                  isDarkMode={isDarkMode}
                  actionButton={
                    <button
                      onClick={() => setShowAddRoleForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Add Role</span>
                    </button>
                  }
                />
              )
            ) : activeNav === "attendance-list" || activeNav === "attendance" ? (
              <DataTable
                title="Today's Attendance Stream"
                description="Real-time attendance logs recorded for today."
                isDarkMode={isDarkMode}
                columns={[
                  { accessorKey: "id", header: "Log ID" },
                  { accessorKey: "name", header: "Employee" },
                  { accessorKey: "timeIn", header: "Check In" },
                  { accessorKey: "timeOut", header: "Check Out" },
                  { accessorKey: "location", header: "Location" },
                  {
                    id: "actions",
                    header: "Actions",
                    enableSorting: false,
                    cell: () => (
                      <div className="flex items-center gap-1.5">
                        <button
                          title="View Details"
                          className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${isDarkMode
                            ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 hover:text-slate-900"
                            }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Edit"
                          className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${isDarkMode
                            ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30 hover:text-blue-300"
                            : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 hover:text-blue-700"
                            }`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Delete"
                          className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${isDarkMode
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 hover:text-rose-300"
                            : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 hover:text-rose-700"
                            }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={[]}
                searchPlaceholder="Filter logs..."
              />
            ) : (
              <div
                className={`rounded-2xl p-8 border text-center space-y-2 backdrop-blur-xl ${isDarkMode
                  ? "bg-[#0B1A30]/90 border-white/[0.08] text-white"
                  : "bg-white border-slate-200 text-slate-900"
                  }`}
              >
                <h3 className="text-lg font-bold capitalize">
                  {activeNav.replace("-", " ")} Workspace
                </h3>
                <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Select Employees, Departments, or Attendance in the sidebar to view common tables & forms.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Reusable Framer Motion Action Modal */}
      <ActionModal
        isOpen={actionState.type !== null}
        type={actionState.type}
        entityTitle={actionState.entity.replace(/s$/, "")}
        data={actionState.data}
        fields={
          actionState.entity === "employees"
            ? employeeFields
            : actionState.entity === "departments"
            ? departmentFields
            : actionState.entity === "designations"
            ? designationFields
            : actionState.entity === "branches"
            ? branchFields
            : actionState.entity === "teams"
            ? teamFields
            : actionState.entity === "roles"
            ? roleFields
            : actionState.type === "edit"
            ? companyEditFields
            : companyFields
        }
        schema={
          actionState.entity === "employees"
            ? employeeSchema
            : actionState.entity === "departments"
            ? departmentSchema
            : actionState.entity === "designations"
            ? designationSchema
            : actionState.entity === "branches"
            ? branchSchema
            : actionState.entity === "teams"
            ? teamSchema
            : actionState.entity === "roles"
            ? roleSchema
            : actionState.type === "edit"
            ? companyEditSchema
            : companySchema
        }
        onClose={() => setActionState({ type: null, entity: "employees", data: null })}
        onConfirmDelete={handleDeleteRecord}
        onSaveEdit={handleEditRecord}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
