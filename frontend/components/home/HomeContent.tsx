"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/home/Sidebar";
import Topbar from "@/components/home/Topbar";
import { DataTable } from "@/components/common/DataTable";
import { DynamicForm, FieldConfig } from "@/components/common/DynamicForm";
import { ActionModal } from "@/components/common/ActionModal";
import { fetchApi, extractList } from "@/lib/api";
import { getCookie } from "@/lib/cookies";
import { UserPlus, Building, Briefcase, ShieldCheck } from "lucide-react";
import { PermissionMatrix } from "@/components/permissions/PermissionMatrix";
import { AttendanceModule } from "@/components/attendance/AttendanceModule";
import { LeaveModule } from "@/components/leave/LeaveModule";
import { TaskModule } from "@/components/task/TaskModule";
import { TicketModule } from "@/components/ticket/TicketModule";
import { AssetModule } from "@/components/asset/AssetModule";
import { ProfileModule } from "@/components/profile/ProfileModule";
import { OrgChartModule } from "@/components/org-chart/OrgChartModule";
import { CompanyModulesModal } from "@/components/company/CompanyModulesModal";
import { CompanySettingsModule } from "@/components/company/CompanySettingsModule";
import { ExitModule } from "@/components/exit/ExitModule";
import { ExpenseModule } from "@/components/expense/ExpenseModule";
import { PerformanceModule } from "@/components/performance/PerformanceModule";
import { PolicyModule } from "@/components/policy/PolicyModule";
import { NotificationModule } from "@/components/notification/NotificationModule";
import {
  Employee,
  EmployeeFormData,
  employeeSchema,
  Department,
  DepartmentFormData,
  departmentSchema,
  DesignationItem,
  DesignationFormData,
  designationSchema,
  CompanyItem,
  CompanyFormData,
  companySchema,
  companyEditSchema,
  BranchItem,
  BranchFormData,
  branchSchema,
  TeamItem,
  TeamFormData,
  teamSchema,
  RoleItem,
  RoleFormData,
  roleSchema,
} from "./types";
import {
  EntityType,
  getEmployeeColumns,
  getDepartmentColumns,
  getDesignationColumns,
  getCompanyColumns,
  getBranchColumns,
  getTeamColumns,
  getRoleColumns,
} from "./columns";

export default function HomeContent() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");

  const handleNavSelect = (id: string, updateUrl = true) => {
    setActiveNav(id);
    if (updateUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tab") !== id) {
        url.searchParams.set("tab", id);
        window.history.pushState({ tab: id }, "", url.toString());
      }
    }
  };

  // Sync active tab with URL query parameter on mount and browser back/forward navigation
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }

    const syncTabFromUrl = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tabFromUrl = params.get("tab");
        if (tabFromUrl) {
          setActiveNav(tabFromUrl);
        }
      }
    };

    syncTabFromUrl();

    const handlePopState = () => {
      syncTabFromUrl();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Primary Data Collections
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);

  // Add Form Visibility States
  const [showAddEmpForm, setShowAddEmpForm] = useState(false);
  const [showAddDeptForm, setShowAddDeptForm] = useState(false);
  const [showAddDesignationForm, setShowAddDesignationForm] = useState(false);
  const [showAddCompanyForm, setShowAddCompanyForm] = useState(false);
  const [showAddBranchForm, setShowAddBranchForm] = useState(false);
  const [showAddTeamForm, setShowAddTeamForm] = useState(false);
  const [showAddRoleForm, setShowAddRoleForm] = useState(false);
  const [companyForModules, setCompanyForModules] = useState<CompanyItem | null>(null);

  // Action Modal State
  type ActionType = "view" | "edit" | "delete" | null;

  const [actionState, setActionState] = useState<{
    type: ActionType;
    entity: EntityType;
    data: any | null;
  }>({
    type: null,
    entity: "employees",
    data: null,
  });

  // Authentication check
  useEffect(() => {
    const authCookie = getCookie("isAuthenticated");
    const authLocal = typeof window !== "undefined" ? localStorage.getItem("isAuthenticated") : null;
    if (authCookie !== "true" && authLocal !== "true") {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // View Details Handler
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

  // Delete Record Handler
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

  // Edit Record Handler
  const handleEditRecord = async (updatedData: any) => {
    const { entity, data } = actionState;
    const rawId = data.rawId || data.id;

    try {
      let payload: any = {};
      if (entity === "employees") {
        const userId = data.userId || data.user_id || data.user?.id;
        const selectedBranch = branches.find(
          (b) => String(b.rawId) === updatedData.branch || b.id === updatedData.branch || b.name === updatedData.branch
        );
        const branchId = selectedBranch
          ? Number(selectedBranch.rawId || selectedBranch.id)
          : (updatedData.branch && !isNaN(Number(updatedData.branch)) ? Number(updatedData.branch) : null);

        const newBranchName = selectedBranch
          ? selectedBranch.name
          : (branchId === null || updatedData.branch === "" ? "Corporate HQ" : data.branch || "Corporate HQ");

        const selectedDesig = designations.find(
          (d) => d.name === updatedData.role || String(d.id) === updatedData.role
        );
        const desigId = selectedDesig && !isNaN(Number((selectedDesig as any).rawId || selectedDesig.id))
          ? Number((selectedDesig as any).rawId || selectedDesig.id)
          : null;

        // Instant Optimistic Local UI Update (0ms)
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.rawId === rawId || emp.id === data.id
              ? {
                  ...emp,
                  branch: newBranchName,
                  branch_id: branchId ?? emp.branch_id,
                  role: selectedDesig ? selectedDesig.name : emp.role,
                  email: updatedData.email || emp.email,
                }
              : emp
          )
        );

        payload = {
          personal_email: updatedData.email,
          ...(desigId ? { designation_id: desigId } : {}),
        };

        const updatePromises: Promise<any>[] = [
          fetchApi(`/${entity}/${rawId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
        ];

        if (userId) {
          updatePromises.push(
            fetchApi(`/users/${userId}`, {
              method: "PUT",
              body: JSON.stringify({ branch_id: branchId }),
            })
          );
        }

        await Promise.all(updatePromises);
        fetchEmployeesData();
        return;
      } else if (entity === "departments") {
        const selectedBranch = branches.find(
          (b) => String(b.rawId) === updatedData.branch || b.id === updatedData.branch || b.name === updatedData.branch
        );
        const branchId = selectedBranch ? Number(selectedBranch.rawId || selectedBranch.id) : (updatedData.branch ? Number(updatedData.branch) : null);

        payload = {
          name: updatedData.name,
          code: updatedData.code,
          description: updatedData.description || null,
          ...(branchId && !isNaN(branchId) ? { branch_id: branchId } : {}),
        };
      } else if (entity === "designations") {
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
          (d) => String((d as any).rawId || d.id) === updatedData.department || d.name === updatedData.department
        );
        const deptId = selectedDept
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

  // Helper Callbacks for Column Definitions
  const columnCallbacks = useMemo(
    () => ({
      isDarkMode,
      onViewDetails: (item: any, entity: EntityType) => handleViewDetails(item, entity),
      onOpenEditModal: (item: any, entity: EntityType) => setActionState({ type: "edit", entity, data: item }),
      onOpenDeleteModal: (item: any, entity: EntityType) => setActionState({ type: "delete", entity, data: item }),
      onManageModules: (item: any) => setCompanyForModules(item),
    }),
    [isDarkMode]
  );

  // Column Specs
  const employeeColumns = useMemo(() => getEmployeeColumns(columnCallbacks), [columnCallbacks]);
  const departmentColumns = useMemo(() => getDepartmentColumns(columnCallbacks), [columnCallbacks]);
  const designationColumns = useMemo(() => getDesignationColumns(columnCallbacks), [columnCallbacks]);
  const companyColumns = useMemo(() => getCompanyColumns(columnCallbacks), [columnCallbacks]);
  const branchColumns = useMemo(() => getBranchColumns(columnCallbacks), [columnCallbacks]);
  const teamColumns = useMemo(() => getTeamColumns(columnCallbacks), [columnCallbacks]);
  const roleColumns = useMemo(() => getRoleColumns(columnCallbacks), [columnCallbacks]);

  // Dynamic Options for Select Fields
  const departmentOptions = useMemo(
    () =>
      departments.map((d) => ({
        label: d.name,
        value: String((d as any).rawId || d.id),
      })),
    [departments]
  );

  const designationOptions = useMemo(
    () =>
      designations.map((d) => ({
        label: d.name,
        value: String((d as any).rawId || d.id),
      })),
    [designations]
  );

  const roleSystemOptions = useMemo(
    () =>
      roles.map((r) => ({
        label: r.name,
        value: String(r.rawId || r.id),
      })),
    [roles]
  );

  const managerOptions = useMemo(
    () =>
      employees.map((e) => ({
        label: `${e.name} (${e.role || "Employee"})`,
        value: String(e.rawId || e.id),
      })),
    [employees]
  );

  const branchOptions = useMemo(() => {
    const dynamicBranches = branches.map((b) => ({
      label: `${b.name} (${b.code})`,
      value: String(b.rawId || b.id),
    }));
    return [{ label: "Corporate HQ (Default)", value: "" }, ...dynamicBranches];
  }, [branches]);

  // Backend API Fetch Methods
  const fetchEmployeesData = async () => {
    try {
      const res = await fetchApi<any>("/employees");
      const list = extractList(res);

      const formattedEmployees: Employee[] = list.map((item: any) => ({
        rawId: item.id,
        userId: item.user_id || item.user?.id,
        id: item.employee_code || (item.id ? `EMP-${String(item.id).padStart(3, "0")}` : "EMP-001"),
        name: item.user?.name || item.name || item.emergency_contact_name || "Employee",
        email: item.user?.email || item.personal_email || item.email || "employee@clanoid.com",
        department: item.user?.department?.name || item.department?.name || (typeof item.department === "string" ? item.department : null) || "-",
        role: item.designation?.name || item.user?.roles?.[0]?.name || (typeof item.role === "string" ? item.role : null) || "-",
        branch: branches.find((b) => Number(b.rawId || b.id) === Number(item.user?.branch_id ?? item.branch_id))?.name || item.user?.branch?.name || item.user?.branch_name || item.branch?.name || (typeof item.branch === "string" ? item.branch : null) || "Corporate HQ",
        branch_id: item.user?.branch_id ?? item.branch_id ?? "",
      }));
      setEmployees(formattedEmployees);
    } catch (err) {
      console.warn("Could not fetch real employees from backend:", err);
      setEmployees([]);
    }
  };

  const fetchDepartmentsData = async () => {
    try {
      const res = await fetchApi<any>("/departments");
      const list = extractList(res);

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

  const fetchDesignationsData = async () => {
    try {
      const res = await fetchApi<any>("/designations");
      const list = extractList(res);

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

  const fetchBranchesData = async () => {
    try {
      const res = await fetchApi<any>("/branches");
      const list = extractList(res);

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

  const fetchTeamsData = async () => {
    try {
      const res = await fetchApi<any>("/teams");
      const list = extractList(res);

      const formattedTeams: TeamItem[] = list.map((item: any) => ({
        rawId: item.id,
        id: item.id ? String(item.id) : `TEAM-${item.code}`,
        name: item.name || "Team",
        code: item.code || "TEAM",
        departmentName: item.department?.name || "-",
        department: String(item.department_id || item.department?.id || ""),
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

  const fetchRolesData = async () => {
    try {
      const res = await fetchApi<any>("/roles");
      const list = extractList(res);

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

  const fetchCompaniesData = async () => {
    try {
      const res = await fetchApi<any>("/companies");
      const list = extractList(res);

      const formattedCompanies: CompanyItem[] = list.map((item: any) => ({
        id: String(item.id),
        name: item.name || "Company",
        slug: item.slug || "company",
        email: item.email || "-",
        phone: item.phone || "-",
        status: item.is_active ? "active" : "inactive",
      }));
      setCompanies(formattedCompanies);
    } catch (err) {
      console.warn("Could not fetch real companies from backend:", err);
      setCompanies([]);
    }
  };

  // Sync Data on Nav selection
  useEffect(() => {
    fetchDepartmentsData();
    fetchDesignationsData();
    fetchBranchesData();
    fetchRolesData();
    if (activeNav === "employees") fetchEmployeesData();
    if (activeNav === "companies") fetchCompaniesData();
    if (activeNav === "branches") fetchBranchesData();
    if (activeNav === "teams") fetchTeamsData();
    if (activeNav === "roles") fetchRolesData();
  }, [activeNav]);

  // Re-resolve employee branch names as soon as both branches and employees finish loading from backend
  useEffect(() => {
    if (branches.length > 0 && employees.length > 0) {
      const needsUpdate = employees.some((emp) => {
        if (!emp.branch_id) return false;
        const matched = branches.find(
          (b) => String(b.rawId || b.id) === String(emp.branch_id)
        );
        return matched && matched.name !== emp.branch;
      });

      if (needsUpdate) {
        setEmployees((prev) =>
          prev.map((emp) => {
            if (!emp.branch_id) return emp;
            const matched = branches.find(
              (b) => String(b.rawId || b.id) === String(emp.branch_id)
            );
            return matched ? { ...emp, branch: matched.name } : emp;
          })
        );
      }
    }
  }, [branches, employees]);

  // Dynamic Form Field Configs
  const employeeFields: FieldConfig<EmployeeFormData>[] = [
    { name: "name", label: "Full Name", placeholder: "e.g. Rahul Sharma" },
    { name: "email", label: "Email Address", type: "email", placeholder: "rahul@company.com" },
    { name: "branch", label: "Branch Location", type: "select", options: branchOptions },
    { name: "department", label: "Department", type: "select", options: departmentOptions },
    { name: "role", label: "Designation", type: "select", options: designationOptions },
    { name: "system_role", label: "System Role", type: "select", options: roleSystemOptions },
    { name: "reporting_manager", label: "Reporting Manager (Optional)", type: "select", options: managerOptions },
    {
      name: "employment_type",
      label: "Employment Type",
      type: "select",
      options: [
        { label: "Full Time", value: "full_time" },
        { label: "Part Time", value: "part_time" },
        { label: "Intern", value: "intern" },
        { label: "Contract", value: "contract" },
        { label: "Consultant", value: "consultant" },
      ],
    },
  ];

  const departmentFields: FieldConfig<DepartmentFormData>[] = [
    { name: "name", label: "Department Name", placeholder: "e.g. Operations & Logistics" },
    { name: "code", label: "Department Code", placeholder: "e.g. OPS" },
    { name: "branch", label: "Branch (Optional)", type: "select", options: branchOptions },
    { name: "description", label: "Description (Optional)", placeholder: "Brief description..." },
  ];

  const designationFields: FieldConfig<DesignationFormData>[] = [
    { name: "name", label: "Designation Name", placeholder: "e.g. Senior Full Stack Engineer" },
    { name: "code", label: "Designation Code", placeholder: "e.g. SR_ENG" },
    { name: "description", label: "Description (Optional)", placeholder: "Brief description..." },
  ];

  const companyFields: FieldConfig<CompanyFormData>[] = [
    { name: "name", label: "Company Name", placeholder: "e.g. Acme Technologies" },
    { name: "email", label: "Company Email", type: "email", placeholder: "contact@acme.com" },
    { name: "slug", label: "Company Slug", placeholder: "acme-tech" },
    { name: "phone", label: "Phone Number", placeholder: "+91 98765 43210" },
    { name: "admin_name", label: "Admin Name", placeholder: "John Administrator" },
    { name: "admin_email", label: "Admin Email", type: "email", placeholder: "admin@acme.com" },
    { name: "admin_password", label: "Admin Password", type: "password", placeholder: "Password123" },
  ];

  const companyEditFields: FieldConfig<any>[] = [
    { name: "name", label: "Company Name", placeholder: "e.g. Acme Technologies" },
    { name: "email", label: "Company Email", type: "email", placeholder: "contact@acme.com" },
    { name: "slug", label: "Company Slug", placeholder: "acme-tech" },
    { name: "phone", label: "Phone Number", placeholder: "+91 98765 43210" },
  ];

  const branchFields: FieldConfig<BranchFormData>[] = [
    { name: "name", label: "Branch Name", placeholder: "e.g. Delhi Regional Office" },
    { name: "code", label: "Branch Code", placeholder: "e.g. DEL-HQ" },
    { name: "email", label: "Email Address (Optional)", type: "email", placeholder: "branch@clanio.com" },
    { name: "phone", label: "Phone Number (Optional)", placeholder: "+91 98765 43210" },
    { name: "address", label: "Address (Optional)", placeholder: "Full office address..." },
  ];

  const teamFields: FieldConfig<TeamFormData>[] = [
    { name: "name", label: "Team Name", placeholder: "e.g. Frontend Engineering" },
    { name: "code", label: "Team Code", placeholder: "e.g. ENG-FE" },
    { name: "department", label: "Department", type: "select", options: departmentOptions },
    { name: "description", label: "Description (Optional)", placeholder: "Brief description..." },
  ];

  const roleFields: FieldConfig<RoleFormData>[] = [
    { name: "name", label: "Role Name", placeholder: "e.g. HR Manager" },
    { name: "slug", label: "Role Slug", placeholder: "e.g. hr_manager" },
    { name: "hierarchy_level", label: "Hierarchy Level (1-99)", type: "number", placeholder: "e.g. 5" },
    {
      name: "data_scope",
      label: "Data Scope",
      type: "select",
      options: [
        { label: "All Company Data", value: "all_company" },
        { label: "Branch Level Data", value: "branch" },
        { label: "Department Level Data", value: "department" },
        { label: "Team Level Data", value: "team" },
        { label: "Self Only Data", value: "self" },
      ],
    },
    { name: "description", label: "Description (Optional)", placeholder: "Brief description..." },
  ];

  // Add Record Handlers
  const handleAddEmployee = async (data: EmployeeFormData) => {
    try {
      const selectedDept = departments.find(
        (d) => d.name === data.department || String(d.id) === data.department || String((d as any).rawId) === data.department
      );
      const deptId = selectedDept ? Number((selectedDept as any).rawId || selectedDept.id || null) : null;

      const selectedDesig = designations.find(
        (d) => d.name === data.role || String(d.id) === data.role || String((d as any).rawId) === data.role
      );
      const desigId = selectedDesig ? Number((selectedDesig as any).rawId || selectedDesig.id || null) : null;

      const selectedRole = roles.find(
        (r) => String(r.rawId) === data.system_role || r.id === data.system_role || r.name === data.system_role || r.slug === data.system_role
      );
      const defaultRole = roles.find((r) => r.slug === "employee" || r.slug === "member") || roles[0];
      const parsedRoleInput = data.system_role ? Number(data.system_role) : NaN;
      const roleId = selectedRole
        ? Number(selectedRole.rawId || selectedRole.id)
        : (!isNaN(parsedRoleInput) && parsedRoleInput > 0
            ? parsedRoleInput
            : Number(defaultRole?.rawId || defaultRole?.id || 8));

      const selectedBranch = branches.find(
        (b) => String(b.rawId) === data.branch || b.id === data.branch || b.name === data.branch
      );
      const branchId = selectedBranch ? Number(selectedBranch.rawId || selectedBranch.id) : (data.branch ? Number(data.branch) : null);

      const selectedManager = employees.find(
        (e) => e.name === data.reporting_manager || String(e.rawId) === data.reporting_manager || e.id === data.reporting_manager
      );
      const managerId = selectedManager ? Number(selectedManager.rawId || selectedManager.id) : (data.reporting_manager && !isNaN(Number(data.reporting_manager)) ? Number(data.reporting_manager) : null);

      const payload: any = {
        date_of_joining: data.date_of_joining || new Date().toISOString().split("T")[0],
        employment_type: data.employment_type || "full_time",
        personal_email: data.email,
        ...(desigId && !isNaN(desigId) ? { designation_id: desigId } : {}),
        ...(managerId && !isNaN(managerId) ? { reporting_manager_id: managerId } : {}),
        user: {
          name: data.name,
          email: data.email,
          password: "Password@2026",
          role_ids: [roleId],
          ...(deptId && !isNaN(deptId) ? { department_id: deptId } : {}),
          ...(branchId && !isNaN(branchId) ? { branch_id: branchId } : {}),
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
      const selectedBranch = branches.find(
        (b) => String(b.rawId) === data.branch || b.id === data.branch || b.name === data.branch
      );
      const branchId = selectedBranch ? Number(selectedBranch.rawId || selectedBranch.id) : (data.branch ? Number(data.branch) : null);

      const payload = {
        name: data.name,
        code: data.code,
        description: data.description || null,
        ...(branchId && !isNaN(branchId) ? { branch_id: branchId } : {}),
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

  const handleAddTeam = async (data: TeamFormData) => {
    try {
      const selectedDept = departments.find(
        (d) => String((d as any).rawId || d.id) === data.department || d.name === data.department
      );
      const deptId = selectedDept ? Number((selectedDept as any).rawId || selectedDept.id) : (data.department ? Number(data.department) : null);

      const payload = {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        department_id: deptId,
        description: data.description?.trim() || null,
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

  const handleAddRole = async (data: RoleFormData) => {
    try {
      const payload = {
        name: data.name.trim(),
        slug: data.slug.trim().toLowerCase(),
        hierarchy_level: Number(data.hierarchy_level),
        data_scope: data.data_scope,
        description: data.description?.trim() || null,
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

  const handleAddCompany = async (data: CompanyFormData) => {
    try {
      const payload = {
        name: data.name,
        email: data.email,
        slug: data.slug,
        phone: data.phone || null,
        admin_name: data.admin_name,
        admin_email: data.admin_email,
        admin_password: data.admin_password,
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`flex h-screen overflow-hidden font-sans ${isDarkMode ? "bg-[#040D1A] text-slate-100" : "bg-[#EEF2F6] text-slate-900"}`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isDarkMode={isDarkMode}
        activeItem={activeNav}
        onSelectItem={(id) => {
          handleNavSelect(id);
          if (typeof window !== "undefined" && window.innerWidth < 768) {
            setIsSidebarCollapsed(true);
          }
        }}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar
          isSidebarOpen={!isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
          onSelectItem={(id) => handleNavSelect(id)}
        />

        <main className={`flex-1 p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto ${isDarkMode ? "" : "bg-[#EEF2F6] shadow-inner"}`}>
          {/* HEADER BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight capitalize">
                {activeNav.replace("-", " ")} Workspace
              </h1>
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
          ) : activeNav === "roles" || activeNav === "users-roles" ? (
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
          ) : activeNav === "permissions" ? (
            <PermissionMatrix isDarkMode={isDarkMode} />
          ) : activeNav === "attendance-list" || activeNav === "attendance" || activeNav === "shift-management" || activeNav === "holidays" || activeNav === "regularization" ? (
            <AttendanceModule isDarkMode={isDarkMode} activeTab={activeNav} />
          ) : activeNav === "leave-requests" || activeNav === "leave" || activeNav === "leave-balance" || activeNav === "leave-policies" ? (
            <LeaveModule isDarkMode={isDarkMode} activeTab={activeNav} />
          ) : activeNav === "task-board" || activeNav === "tasks" || activeNav === "daily-reports" || activeNav === "sod-eod" || activeNav === "work-record" ? (
            <TaskModule isDarkMode={isDarkMode} activeTab={activeNav} />
          ) : activeNav === "tickets" || activeNav === "support-tickets" || activeNav === "ticket-categories" || activeNav === "helpdesk" ? (
            <TicketModule isDarkMode={isDarkMode} activeTab={activeNav} />
          ) : activeNav === "assets" || activeNav === "company-assets" || activeNav === "my-assets" || activeNav === "asset-requests" ? (
            <AssetModule isDarkMode={isDarkMode} activeTab={activeNav} />
          ) : activeNav === "profile" || activeNav === "employee-documents" || activeNav === "security" || activeNav === "account" ? (
            <ProfileModule isDarkMode={isDarkMode} />
          ) : activeNav === "organization-chart" || activeNav === "org-chart" ? (
            <OrgChartModule isDarkMode={isDarkMode} />
          ) : activeNav === "company-settings" ? (
            <CompanySettingsModule isDarkMode={isDarkMode} />
          ) : activeNav === "employee-exits" || activeNav === "exits" || activeNav === "clearance" ? (
            <ExitModule isDarkMode={isDarkMode} activeTab={activeNav} />
          ) : activeNav === "expenses" || activeNav === "expense-claims" ? (
            <ExpenseModule isDarkMode={isDarkMode} />
          ) : activeNav === "performance-goals" || activeNav === "performance" || activeNav === "appraisals" || activeNav === "incentives" || activeNav === "recognitions" || activeNav === "performance-score" ? (
            <PerformanceModule isDarkMode={isDarkMode} activeTab={activeNav} />
          ) : activeNav === "company-policies" || activeNav === "policies" ? (
            <PolicyModule isDarkMode={isDarkMode} />
          ) : activeNav === "notifications" || activeNav === "announcements" ? (
            <NotificationModule isDarkMode={isDarkMode} />
          ) : activeNav === "dashboard" ? (
            <div className="space-y-6">
              {/* Dashboard Metric Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => setActiveNav("employees")}
                  className={`p-5 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                    isDarkMode
                      ? "bg-[#0B1A30]/90 border-white/[0.08] hover:border-blue-500/50"
                      : "bg-white border-slate-200 shadow-xs hover:border-blue-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Employees</span>
                    <div className="p-2 rounded-xl bg-blue-500/15 text-blue-500">
                      <UserPlus className="w-5 h-5" />
                    </div>
                  </div>
                  <p className={`text-2xl font-extrabold mt-3 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{employees.length}</p>
                  <p className="text-[11px] text-blue-500 font-semibold mt-1">Manage Directory →</p>
                </div>

                <div
                  onClick={() => setActiveNav("departments")}
                  className={`p-5 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                    isDarkMode
                      ? "bg-[#0B1A30]/90 border-white/[0.08] hover:border-purple-500/50"
                      : "bg-white border-slate-200 shadow-xs hover:border-purple-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Departments</span>
                    <div className="p-2 rounded-xl bg-purple-500/15 text-purple-500">
                      <Building className="w-5 h-5" />
                    </div>
                  </div>
                  <p className={`text-2xl font-extrabold mt-3 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{departments.length}</p>
                  <p className="text-[11px] text-purple-500 font-semibold mt-1">View Departments →</p>
                </div>

                <div
                  onClick={() => setActiveNav("attendance")}
                  className={`p-5 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                    isDarkMode
                      ? "bg-[#0B1A30]/90 border-white/[0.08] hover:border-emerald-500/50"
                      : "bg-white border-slate-200 shadow-xs hover:border-emerald-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Attendance Terminal</span>
                    <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                      <Briefcase className="w-5 h-5" />
                    </div>
                  </div>
                  <p className={`text-2xl font-extrabold mt-3 ${isDarkMode ? "text-white" : "text-slate-900"}`}>Live Check-In</p>
                  <p className="text-[11px] text-emerald-500 font-semibold mt-1">Clock In / Out →</p>
                </div>

                <div
                  onClick={() => setActiveNav("task-board")}
                  className={`p-5 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                    isDarkMode
                      ? "bg-[#0B1A30]/90 border-white/[0.08] hover:border-amber-500/50"
                      : "bg-white border-slate-200 shadow-xs hover:border-amber-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tasks & SOD/EOD</span>
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>
                  <p className={`text-2xl font-extrabold mt-3 ${isDarkMode ? "text-white" : "text-slate-900"}`}>Task Board</p>
                  <p className="text-[11px] text-amber-500 font-semibold mt-1">View Work Terminal →</p>
                </div>
              </div>

              {/* Main Quick Access Table for Employees */}
              <DataTable
                title="Company Employee Directory"
                description="Overview of active company members, roles, and branch assignments."
                columns={employeeColumns}
                data={employees}
                searchPlaceholder="Search employees by name, email, department..."
                isDarkMode={isDarkMode}
                actionButton={
                  <button
                    onClick={() => setShowAddEmpForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add Employee</span>
                  </button>
                }
              />
            </div>
          ) : (
            <div
              className={`rounded-2xl p-8 border text-center space-y-2 backdrop-blur-xl ${
                isDarkMode
                  ? "bg-[#0B1A30]/90 border-white/[0.08] text-white"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <h3 className="text-lg font-bold capitalize">{activeNav.replace("-", " ")} Workspace</h3>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Select Employees, Departments, or Attendance in the sidebar to view common tables & forms.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Action Modal for View / Edit / Delete operations */}
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
            : actionState.entity === "companies"
            ? actionState.type === "edit"
              ? companyEditFields
              : companyFields
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
            : actionState.entity === "companies"
            ? actionState.type === "edit"
              ? companyEditSchema
              : companySchema
            : companySchema
        }
        onClose={() => setActionState({ type: null, entity: "employees", data: null })}
        onConfirmDelete={handleDeleteRecord}
        onSaveEdit={handleEditRecord}
        isDarkMode={isDarkMode}
      />

      <CompanyModulesModal
        companyId={companyForModules?.id || ""}
        companyName={companyForModules?.name || ""}
        isOpen={Boolean(companyForModules)}
        onClose={() => setCompanyForModules(null)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
