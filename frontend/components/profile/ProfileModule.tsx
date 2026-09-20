"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  User,
  ShieldCheck,
  KeyRound,
  FileText,
  UploadCloud,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Camera,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  Check,
  Lock,
  ArrowRight,
  RefreshCw,
  Plus,
} from "lucide-react";
import { fetchApi, extractList } from "@/lib/api";

interface ProfileModuleProps {
  isDarkMode?: boolean;
}

export const ProfileModule: React.FC<ProfileModuleProps> = ({
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "completion" | "edit" | "documents" | "security"
  >("overview");

  // Profile Data State
  const [profile, setProfile] = useState<any>(null);
  const [completion, setCompletion] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  // Loading States
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingCompletion, setLoadingCompletion] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Notification State
  const [notify, setNotify] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [editFormData, setEditFormData] = useState({
    name: "",
    phone: "",
    personal_email: "",
    personal_phone: "",
    date_of_birth: "",
    gender: "",
    marital_status: "",
    blood_group: "",
    current_address: "",
    permanent_address: "",
    emergency_contact_name: "",
    emergency_contact_relation: "",
    emergency_contact_phone: "",
    pan_number: "",
    has_pf_account: false,
    uan_number: "",
    aadhaar_number: "",
  });

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });

  const [docFormData, setDocFormData] = useState({
    type: "photo",
    title: "",
    document_number: "",
    issued_on: "",
    expires_on: "",
  });
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);

  const showNotify = (msg: string, type: "success" | "error" = "success") => {
    setNotify({ msg, type });
    setTimeout(() => setNotify(null), 4000);
  };

  // Fetch Full Profile
  const fetchProfileData = async () => {
    setLoadingProfile(true);
    try {
      const res = await fetchApi<any>("/profile");
      const data = res?.data || res;
      setProfile(data);

      if (data) {
        const emp = data.employee || {};
        setEditFormData({
          name: data.name || "",
          phone: data.phone || "",
          personal_email: emp.personal_email || "",
          personal_phone: emp.personal_phone || "",
          date_of_birth: emp.date_of_birth || "",
          gender: emp.gender || "",
          marital_status: emp.marital_status || "",
          blood_group: emp.blood_group || "",
          current_address: emp.current_address || "",
          permanent_address: emp.permanent_address || "",
          emergency_contact_name: emp.emergency_contact_name || "",
          emergency_contact_relation: emp.emergency_contact_relation || "",
          emergency_contact_phone: emp.emergency_contact_phone || "",
          pan_number: emp.pan_number || "",
          has_pf_account: Boolean(emp.has_pf_account),
          uan_number: emp.uan_number || "",
          aadhaar_number: emp.aadhaar_number || "",
        });
      }
    } catch (err: any) {
      showNotify(err.message || "Failed to load profile", "error");
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch Completion Progress
  const fetchCompletionData = async () => {
    setLoadingCompletion(true);
    try {
      const res = await fetchApi<any>("/profile/completion");
      setCompletion(res?.data || res);
    } catch (err: any) {
      console.warn("Could not load profile completion:", err);
    } finally {
      setLoadingCompletion(false);
    }
  };

  // Fetch Documents
  const fetchDocumentsData = async () => {
    setLoadingDocuments(true);
    try {
      const res = await fetchApi<any>("/profile/documents");
      const list = extractList(res);
      setDocuments(list);
    } catch (err: any) {
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
    fetchCompletionData();
    fetchDocumentsData();
  }, []);

  // Update Profile Info
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      const payload: any = {
        name: editFormData.name,
        phone: editFormData.phone || null,
        personal_email: editFormData.personal_email || null,
        personal_phone: editFormData.personal_phone || null,
        date_of_birth: editFormData.date_of_birth || null,
        gender: editFormData.gender || null,
        marital_status: editFormData.marital_status || null,
        blood_group: editFormData.blood_group || null,
        current_address: editFormData.current_address || null,
        permanent_address: editFormData.permanent_address || null,
        emergency_contact_name: editFormData.emergency_contact_name || null,
        emergency_contact_relation: editFormData.emergency_contact_relation || null,
        emergency_contact_phone: editFormData.emergency_contact_phone || null,
        pan_number: editFormData.pan_number || null,
        has_pf_account: editFormData.has_pf_account,
        ...(editFormData.has_pf_account && editFormData.uan_number
          ? { uan_number: editFormData.uan_number }
          : {}),
        ...(editFormData.aadhaar_number
          ? { aadhaar_number: editFormData.aadhaar_number }
          : {}),
      };

      const res = await fetchApi<any>("/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      showNotify("Profile details updated successfully!");
      fetchProfileData();
      fetchCompletionData();
      setActiveTab("overview");
    } catch (err: any) {
      showNotify(err.message || "Failed to update profile", "error");
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Upload Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      await fetchApi("/profile/avatar", {
        method: "POST",
        body: formData,
      });
      showNotify("Profile picture updated!");
      fetchProfileData();
    } catch (err: any) {
      showNotify(err.message || "Failed to upload avatar", "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Delete Avatar
  const handleDeleteAvatar = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;
    setUploadingAvatar(true);
    try {
      await fetchApi("/profile/avatar", { method: "DELETE" });
      showNotify("Profile picture removed!");
      fetchProfileData();
    } catch (err: any) {
      showNotify(err.message || "Failed to remove avatar", "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.password_confirmation) {
      showNotify("New passwords do not match!", "error");
      return;
    }

    setChangingPassword(true);
    try {
      await fetchApi("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: passwordData.current_password,
          password: passwordData.password,
          password_confirmation: passwordData.password_confirmation,
        }),
      });
      showNotify("Password changed successfully! Please keep it secure.");
      setPasswordData({
        current_password: "",
        password: "",
        password_confirmation: "",
      });
    } catch (err: any) {
      showNotify(err.message || "Failed to change password", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  // Upload Document
  const handleUploadDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocFile) {
      showNotify("Please select a document file to upload.", "error");
      return;
    }

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("file", selectedDocFile);
    formData.append("type", docFormData.type);
    if (docFormData.title) formData.append("title", docFormData.title);
    if (docFormData.document_number)
      formData.append("document_number", docFormData.document_number);
    if (docFormData.issued_on) formData.append("issued_on", docFormData.issued_on);
    if (docFormData.expires_on)
      formData.append("expires_on", docFormData.expires_on);

    try {
      await fetchApi("/profile/documents", {
        method: "POST",
        body: formData,
      });
      showNotify("Document uploaded successfully!");
      setDocFormData({
        type: "photo",
        title: "",
        document_number: "",
        issued_on: "",
        expires_on: "",
      });
      setSelectedDocFile(null);
      fetchDocumentsData();
      fetchCompletionData();
    } catch (err: any) {
      showNotify(err.message || "Failed to upload document", "error");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await fetchApi(`/profile/documents/${docId}`, { method: "DELETE" });
      showNotify("Document deleted successfully!");
      fetchDocumentsData();
      fetchCompletionData();
    } catch (err: any) {
      showNotify(err.message || "Failed to delete document", "error");
    }
  };

  if (loadingProfile && !profile) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
        <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          Loading user profile & extensions...
        </p>
      </div>
    );
  }

  const emp = profile?.employee || {};
  const org = profile?.organisation || {};

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification Banner */}
      {notify && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all shadow-lg animate-in fade-in slide-in-from-top-2 ${
            notify.type === "success"
              ? isDarkMode
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
              : isDarkMode
              ? "bg-rose-950/80 border-rose-500/40 text-rose-300"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notify.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notify.msg}</span>
          </div>
          <button onClick={() => setNotify(null)}>
            <X className="w-4 h-4 opacity-70 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* HEADER CARD */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden backdrop-blur-xl transition-all ${
          isDarkMode
            ? "bg-[#0B1A30]/90 border-white/[0.08] shadow-2xl"
            : "bg-white border-slate-200 shadow-xl"
        }`}
      >
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar Container with Upload Overlay */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1 bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 shadow-xl shadow-purple-500/20">
              <div
                className={`w-full h-full rounded-[22px] overflow-hidden relative flex items-center justify-center ${
                  isDarkMode ? "bg-[#081425]" : "bg-slate-100"
                }`}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-extrabold text-white">
                    {profile?.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase() || "U"}
                  </span>
                )}
              </div>
            </div>

            {/* Avatar Upload Actions */}
            <div className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
                title="Change Photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              {profile?.avatar_url && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  disabled={uploadingAvatar}
                  className="p-2 rounded-xl bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 transition-all cursor-pointer"
                  title="Remove Photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarChange}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
            />
          </div>

          {/* Profile Basic Information */}
          <div className="flex-1 text-center md:text-left space-y-2 min-w-0">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <h1
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                {profile?.name}
              </h1>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {emp.employee_code || "EMP-001"}
              </span>
              {profile?.is_super_admin && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Super Admin
                </span>
              )}
            </div>

            <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {emp.designation?.name || "Employee"} • {org.department?.name || "Corporate"} •{" "}
              {org.branch?.name || "HQ"}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Mail className="w-3.5 h-3.5 text-purple-400" />
                <span>{profile?.email}</span>
              </div>
              {profile?.phone && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{profile.phone}</span>
                </div>
              )}
              {emp.date_of_joining && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Joined: {emp.date_of_joining}</span>
                </div>
              )}
            </div>
          </div>

          {/* Onboarding Gauge Widget */}
          {completion && (
            <div
              onClick={() => setActiveTab("completion")}
              className={`p-4 rounded-2xl border shrink-0 text-center cursor-pointer transition-all hover:scale-105 ${
                isDarkMode
                  ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]"
                  : "bg-purple-50/70 border-purple-100 hover:bg-purple-100/70"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                Profile Completion
              </div>
              <div className="text-2xl font-black text-purple-400 mt-1">
                {completion.percent ?? 0}%
              </div>
              <div className="w-32 bg-slate-700/30 rounded-full h-1.5 mt-2 overflow-hidden mx-auto">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${completion.percent ?? 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* TABS NAVIGATION */}
        <div
          className={`flex items-center gap-2 mt-8 pt-4 border-t overflow-x-auto scrollbar-none ${
            isDarkMode ? "border-white/[0.08]" : "border-slate-100"
          }`}
        >
          {[
            { id: "overview", label: "Overview", icon: User },
            { id: "completion", label: "Completion Status", icon: Sparkles },
            { id: "edit", label: "Edit Personal Details", icon: Edit3 },
            { id: "documents", label: "My Documents", icon: FileText },
            { id: "security", label: "Security & Password", icon: KeyRound },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-purple-500/25"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Box */}
          <div
            className={`lg:col-span-2 p-6 rounded-3xl border space-y-6 ${
              isDarkMode
                ? "bg-[#0B1A30]/90 border-white/[0.08]"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Personal & Emergency Details
              </h3>
              <button
                onClick={() => setActiveTab("edit")}
                className="text-xs font-bold text-purple-400 hover:underline flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Details
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Gender</div>
                <div className={`font-semibold capitalize mt-1 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {emp.gender || "Not specified"}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</div>
                <div className={`font-semibold mt-1 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {emp.date_of_birth || "Not specified"}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Marital Status</div>
                <div className={`font-semibold capitalize mt-1 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {emp.marital_status || "Not specified"}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Blood Group</div>
                <div className={`font-semibold mt-1 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {emp.blood_group || "Not specified"}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Personal Email</div>
                <div className={`font-semibold mt-1 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {emp.personal_email || "Not specified"}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Personal Phone</div>
                <div className={`font-semibold mt-1 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {emp.personal_phone || "Not specified"}
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <h4 className={`text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                Address Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Current Address</div>
                  <div className={`mt-1 font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {emp.current_address || "Not provided"}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Permanent Address</div>
                  <div className={`mt-1 font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {emp.permanent_address || "Not provided"}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <h4 className={`text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                Emergency Contact
              </h4>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                <div>
                  <div className={`font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {emp.emergency_contact_name || "None Listed"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Relation: {emp.emergency_contact_relation || "-"}
                  </div>
                </div>
                <div className="font-mono text-purple-400 font-semibold">
                  {emp.emergency_contact_phone || "-"}
                </div>
              </div>
            </div>
          </div>

          {/* Side Compliance / Statutory Box */}
          <div className="space-y-6">
            <div
              className={`p-6 rounded-3xl border space-y-4 ${
                isDarkMode
                  ? "bg-[#0B1A30]/90 border-white/[0.08]"
                  : "bg-white border-slate-200"
              }`}
            >
              <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Tax & Statutory Info
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400">PAN Number</span>
                  <span className="font-mono font-bold text-purple-400">
                    {emp.pan_number || "Not Added"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400">Aadhaar Number</span>
                  <span className="font-mono font-bold text-purple-400">
                    {emp.aadhaar_number || "Not Added"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400">UAN Number</span>
                  <span className="font-mono font-bold text-purple-400">
                    {emp.uan_number || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Reporting Manager Box */}
            <div
              className={`p-6 rounded-3xl border space-y-3 ${
                isDarkMode
                  ? "bg-[#0B1A30]/90 border-white/[0.08]"
                  : "bg-white border-slate-200"
              }`}
            >
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Reporting Manager
              </h3>
              {emp.reporting_manager ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs">
                    {emp.reporting_manager.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                      {emp.reporting_manager.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {emp.reporting_manager.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">No manager assigned</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: COMPLETION STATUS */}
      {activeTab === "completion" && completion && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode
              ? "bg-[#0B1A30]/90 border-white/[0.08]"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className={`text-lg font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                Profile Completion Progress
              </h3>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Complete all steps to verify your onboarding status.
              </p>
            </div>
            <div className="text-2xl font-black text-purple-400">
              {completion.percent ?? 0}% Completed
            </div>
          </div>

          {/* Step Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: "personal", label: "Personal Details" },
              { key: "family", label: "Family Members" },
              { key: "bank", label: "Bank Accounts" },
              { key: "documents", label: "Required Documents" },
            ].map((step) => {
              const isDone = Boolean(completion.steps?.[step.key]);
              return (
                <div
                  key={step.key}
                  className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                    isDone
                      ? isDarkMode
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : isDarkMode
                      ? "bg-white/[0.03] border-white/[0.06] text-slate-400"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="font-bold">{step.label}</span>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Missing Documents Warning */}
          {completion.missing_documents && completion.missing_documents.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
              <div className="font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Action Required: Missing Onboarding Documents</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Please upload the following required documents under the "My Documents" tab:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {completion.missing_documents.map((doc: string) => (
                  <span
                    key={doc}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 font-mono font-bold uppercase text-[10px]"
                  >
                    {doc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: EDIT PERSONAL DETAILS */}
      {activeTab === "edit" && (
        <form
          onSubmit={handleUpdateProfile}
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode
              ? "bg-[#0B1A30]/90 border-white/[0.08]"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Update Profile Information
            </h3>
            <span className="text-[11px] text-purple-400 font-semibold">
              Self-service Editable Fields
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Full Name</label>
              <input
                type="text"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Phone Number</label>
              <input
                type="text"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Date of Birth</label>
              <input
                type="date"
                value={editFormData.date_of_birth}
                onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Gender</label>
              <select
                value={editFormData.gender}
                onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Marital Status</label>
              <select
                value={editFormData.marital_status}
                onChange={(e) => setEditFormData({ ...editFormData, marital_status: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="">Select Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Blood Group</label>
              <select
                value={editFormData.blood_group}
                onChange={(e) => setEditFormData({ ...editFormData, blood_group: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="">Select Blood Group</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Personal Email</label>
              <input
                type="email"
                value={editFormData.personal_email}
                onChange={(e) => setEditFormData({ ...editFormData, personal_email: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Personal Phone</label>
              <input
                type="text"
                value={editFormData.personal_phone}
                onChange={(e) => setEditFormData({ ...editFormData, personal_phone: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Current Address</label>
              <textarea
                rows={2}
                value={editFormData.current_address}
                onChange={(e) => setEditFormData({ ...editFormData, current_address: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Permanent Address</label>
              <textarea
                rows={2}
                value={editFormData.permanent_address}
                onChange={(e) => setEditFormData({ ...editFormData, permanent_address: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">PAN Number</label>
              <input
                type="text"
                maxLength={10}
                value={editFormData.pan_number}
                onChange={(e) => setEditFormData({ ...editFormData, pan_number: e.target.value })}
                placeholder="ABCDE1234F"
                className={`w-full p-3 rounded-2xl border uppercase font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">Aadhaar Number</label>
              <input
                type="text"
                maxLength={12}
                value={editFormData.aadhaar_number}
                onChange={(e) => setEditFormData({ ...editFormData, aadhaar_number: e.target.value })}
                placeholder="12-digit number"
                className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={updatingProfile}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              {updatingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT 4: MY DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          {/* Document Upload Card */}
          <form
            onSubmit={handleUploadDocumentSubmit}
            className={`p-6 sm:p-8 rounded-3xl border space-y-4 ${
              isDarkMode
                ? "bg-[#0B1A30]/90 border-white/[0.08]"
                : "bg-white border-slate-200"
            }`}
          >
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Upload New Document
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold mb-1 text-slate-400">
                  Document Type *
                </label>
                <select
                  value={docFormData.type}
                  onChange={(e) => setDocFormData({ ...docFormData, type: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="photo">Passport Photo</option>
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="resume">Resume</option>
                  <option value="offer_letter">Offer Letter</option>
                  <option value="education_certificate">Education Certificate</option>
                  <option value="experience_letter">Experience Letter</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1 text-slate-400">
                  Title / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Higher Secondary Certificate"
                  value={docFormData.title}
                  onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                  className={`w-full p-3 rounded-2xl border outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1 text-slate-400">
                  Document Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ABC1234567"
                  value={docFormData.document_number}
                  onChange={(e) =>
                    setDocFormData({ ...docFormData, document_number: e.target.value })
                  }
                  className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[11px] font-bold mb-1 text-slate-400">
                  File Attachment (PDF, JPG, PNG, WEBP - Max 5MB) *
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => docFileInputRef.current?.click()}
                    className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                      isDarkMode
                        ? "bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]"
                        : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <UploadCloud className="w-4 h-4 text-purple-400" />
                    <span>{selectedDocFile ? selectedDocFile.name : "Choose File"}</span>
                  </button>
                  <input
                    type="file"
                    ref={docFileInputRef}
                    onChange={(e) => setSelectedDocFile(e.target.files?.[0] || null)}
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                  />
                  {selectedDocFile && (
                    <span className="text-xs text-purple-400 font-semibold">
                      {(selectedDocFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={uploadingDoc}
                className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {uploadingDoc ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>Upload Document</span>
              </button>
            </div>
          </form>

          {/* Documents List Table */}
          <div
            className={`p-6 sm:p-8 rounded-3xl border space-y-4 ${
              isDarkMode
                ? "bg-[#0B1A30]/90 border-white/[0.08]"
                : "bg-white border-slate-200"
            }`}
          >
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Uploaded Profile Documents ({documents.length})
            </h3>

            {documents.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                      isDarkMode
                        ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                        : "bg-slate-50 border-slate-100 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`font-bold capitalize ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {doc.title || doc.type}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Type: {doc.type} • Status:{" "}
                          <span
                            className={`font-semibold capitalize ${
                              doc.status === "verified"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            {doc.status || "pending"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: SECURITY & CHANGE PASSWORD */}
      {activeTab === "security" && (
        <form
          onSubmit={handleChangePassword}
          className={`p-6 sm:p-8 rounded-3xl border max-w-xl space-y-6 ${
            isDarkMode
              ? "bg-[#0B1A30]/90 border-white/[0.08]"
              : "bg-white border-slate-200"
          }`}
        >
          <div>
            <h3 className={`text-lg font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Change Password
            </h3>
            <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Ensure your account uses a strong, unique password.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">
                Current Password *
              </label>
              <input
                type="password"
                required
                value={passwordData.current_password}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, current_password: e.target.value })
                }
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">
                New Password (Min 8 chars, letters & numbers) *
              </label>
              <input
                type="password"
                required
                value={passwordData.password}
                onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 text-slate-400">
                Confirm New Password *
              </label>
              <input
                type="password"
                required
                value={passwordData.password_confirmation}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, password_confirmation: e.target.value })
                }
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {changingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>Update Password</span>
          </button>
        </form>
      )}
    </div>
  );
};

export default ProfileModule;
