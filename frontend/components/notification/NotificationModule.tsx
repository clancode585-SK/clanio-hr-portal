"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  X,
  Check,
  Megaphone,
  Sliders,
  Send,
  Trash2,
  Mail,
  Smartphone,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCheck,
} from "lucide-react";
import { fetchApi, extractList } from "@/lib/api";

interface NotificationModuleProps {
  isDarkMode?: boolean;
}

export const NotificationModule: React.FC<NotificationModuleProps> = ({
  isDarkMode = false,
}) => {
  const [tab, setTab] = useState<"inbox" | "announce" | "preferences">("inbox");

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadSummary, setUnreadSummary] = useState<any>({ unread_count: 0, urgent_count: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [groupFilter, setGroupFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Forms
  const [notify, setNotify] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Announcement Form
  const [announceForm, setAnnounceForm] = useState({
    title: "",
    body: "",
    priority: "normal",
    action_url: "",
  });

  // Preferences State
  const [preferences, setPreferences] = useState<any>({
    email_enabled: true,
    in_app_enabled: true,
    whatsapp_enabled: false,
    push_enabled: true,
  });

  // 1. Fetch Unread Summary
  const fetchSummary = async () => {
    try {
      const res = await fetchApi<any>("/notifications/unread-count");
      setUnreadSummary(res?.data || res);
    } catch {
      // ignore
    }
  };

  // 2. Fetch Notifications List
  const fetchNotificationsData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.append("unread", "1");
      if (groupFilter) params.append("group", groupFilter);

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await fetchApi<any>(`/notifications${queryStr}`);
      setNotifications(extractList(res));
      fetchSummary();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to fetch notifications", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Preferences
  const fetchPreferences = async () => {
    try {
      const res = await fetchApi<any>("/notifications/preferences");
      if (res?.data || res) setPreferences(res?.data || res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotificationsData();
    fetchPreferences();
  }, [tab, unreadOnly, groupFilter]);

  // Mark Single Notification Read
  const handleMarkRead = async (id: number | string) => {
    try {
      await fetchApi(`/notifications/${id}/read`, { method: "PUT" });
      fetchNotificationsData();
    } catch {
      // ignore
    }
  };

  // Mark All Notifications Read
  const handleMarkAllRead = async () => {
    setSubmitting(true);
    try {
      await fetchApi("/notifications/read-all", { method: "PUT" });
      setNotify({ msg: "All notifications marked as read", type: "success" });
      fetchNotificationsData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to mark all as read", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Clear Notifications
  const handleClearNotifications = async () => {
    if (!confirm("Are you sure you want to clear all read notifications?")) return;
    setSubmitting(true);
    try {
      await fetchApi("/notifications?only_read=1", { method: "DELETE" });
      setNotify({ msg: "Read notifications cleared", type: "success" });
      fetchNotificationsData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to clear notifications", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Single Notification
  const handleDeleteNotification = async (id: number | string) => {
    try {
      await fetchApi(`/notifications/${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchSummary();
    } catch {
      // ignore
    }
  };

  // Broadcast Announcement
  const handleAnnounceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceForm.title.trim()) {
      setNotify({ msg: "Please enter announcement title", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      await fetchApi("/notifications/announce", {
        method: "POST",
        body: JSON.stringify(announceForm),
      });

      setNotify({ msg: "Company announcement broadcasted successfully!", type: "success" });
      setAnnounceForm({
        title: "",
        body: "",
        priority: "normal",
        action_url: "",
      });
      setTab("inbox");
      fetchNotificationsData();
    } catch (err: any) {
      setNotify({ msg: err.message || "Failed to send announcement", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const q = searchQuery.toLowerCase().trim();
      const title = n.title || "";
      const body = n.body || "";
      return title.toLowerCase().includes(q) || body.toLowerCase().includes(q);
    });
  }, [notifications, searchQuery]);

  return (
    <div className="space-y-6 font-sans">
      {/* NOTIFICATION BANNER */}
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
          <button onClick={() => setNotify(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 via-purple-600 to-indigo-600 text-white shadow-md">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Notifications & Communication Hub
              </h1>
              <p className={`text-xs mt-0.5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Manage company broadcasts, system alerts, channel preferences, and read receipts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAllRead}
              disabled={submitting}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isDarkMode
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900"
              }`}
            >
              <CheckCheck className="w-4 h-4 text-purple-400" />
              <span>Mark All Read</span>
            </button>
            <button
              onClick={() => setTab("announce")}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Megaphone className="w-4 h-4" />
              <span>Post Announcement</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/20 text-xs">
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-purple-50/60 border-purple-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Inbox</div>
            <div className="text-lg font-black text-purple-400 mt-0.5">{notifications.length}</div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-amber-50/60 border-amber-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Unread Alerts</div>
            <div className="text-lg font-black text-amber-400 mt-0.5">
              {unreadSummary?.unread_count ?? notifications.filter((n) => !n.read_at).length}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-rose-50/60 border-rose-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Urgent Alerts</div>
            <div className="text-lg font-black text-rose-400 mt-0.5">
              {unreadSummary?.urgent_count ?? 0}
            </div>
          </div>
          <div
            className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? "bg-white/[0.03] border-white/[0.06]" : "bg-emerald-50/60 border-emerald-100"
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Push Status</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">Active</div>
          </div>
        </div>

        {/* NAVIGATION TABS & CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-700/20">
          <div
            className={`p-1 rounded-2xl border flex flex-wrap items-center gap-1 ${
              isDarkMode ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-100 border-slate-200"
            }`}
          >
            <button
              onClick={() => setTab("inbox")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "inbox"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Notifications Inbox
            </button>
            <button
              onClick={() => setTab("announce")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "announce"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Broadcast Announcement
            </button>
            <button
              onClick={() => setTab("preferences")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === "preferences"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xs"
                  : isDarkMode
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Channel Preferences
            </button>
          </div>

          {tab === "inbox" && (
            <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-2xl text-xs outline-none border transition-all ${
                    isDarkMode
                      ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                      : "bg-slate-100 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              {/* Unread Toggle */}
              <button
                onClick={() => setUnreadOnly(!unreadOnly)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                  unreadOnly
                    ? "bg-purple-600 text-white border-purple-500"
                    : isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-slate-400 hover:text-white"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                {unreadOnly ? "Showing Unread" : "All Notifications"}
              </button>

              <button
                onClick={handleClearNotifications}
                className="p-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                title="Clear Read Notifications"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={fetchNotificationsData}
                className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: INBOX LIST */}
      {tab === "inbox" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          {loading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
              <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Loading notifications...
              </p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No notifications found in your inbox.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((n) => {
                const isUnread = !n.read_at;

                return (
                  <div
                    key={n.id}
                    className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                      isUnread
                        ? isDarkMode
                          ? "bg-purple-500/10 border-purple-500/30"
                          : "bg-purple-50/80 border-purple-200"
                        : isDarkMode
                        ? "bg-white/[0.02] border-white/[0.06]"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                          n.priority === "urgent" || n.priority === "high"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        }`}
                      >
                        {n.priority === "urgent" ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={`text-xs font-extrabold truncate ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {n.title}
                          </h4>
                          {isUnread && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-500 text-white">
                              New
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {n.created_at || "Just now"}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isUnread && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(n.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BROADCAST ANNOUNCEMENT */}
      {tab === "announce" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          <div className="border-b pb-4 border-slate-700/20">
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Broadcast Company Announcement
            </h3>
            <p className="text-xs text-slate-400">
              Send instant organization-wide announcements or priority notifications to all staff members.
            </p>
          </div>

          <form onSubmit={handleAnnounceSubmit} className="space-y-4 text-xs max-w-xl">
            <div>
              <label className="block font-bold mb-1 text-slate-400">Announcement Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Townhall Meeting Scheduled for Friday 4:00 PM"
                value={announceForm.title}
                onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-400">Priority Level</label>
              <select
                value={announceForm.priority}
                onChange={(e) => setAnnounceForm({ ...announceForm, priority: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-[#081425] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="low">Low Priority</option>
                <option value="normal">Normal Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Alert</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-400">Announcement Message Body</label>
              <textarea
                rows={4}
                placeholder="Detailed announcement notes..."
                value={announceForm.body}
                onChange={(e) => setAnnounceForm({ ...announceForm, body: e.target.value })}
                className={`w-full p-3 rounded-2xl border outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-400">Target Action URL (Optional)</label>
              <input
                type="text"
                placeholder="e.g. /company-policies or https://zoom.us/..."
                value={announceForm.action_url}
                onChange={(e) => setAnnounceForm({ ...announceForm, action_url: e.target.value })}
                className={`w-full p-3 rounded-2xl border font-mono outline-none ${
                  isDarkMode
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-purple-500"
                    : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-lg flex items-center gap-2 cursor-pointer"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Send Announcement</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CHANNEL PREFERENCES */}
      {tab === "preferences" && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
            isDarkMode ? "bg-[#0B1A30]/90 border-white/[0.08]" : "bg-white border-slate-200"
          }`}
        >
          <div className="border-b pb-4 border-slate-700/20">
            <h3 className={`text-base font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Notification Channel Preferences
            </h3>
            <p className="text-xs text-slate-400">
              Control how and where you receive automated HR notifications and system updates.
            </p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="p-4 rounded-2xl border flex items-center justify-between bg-white/[0.02] border-white/[0.06]">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="font-bold text-white">Email Notifications</div>
                  <div className="text-[10px] text-slate-400">Receive leave, expense & appraisal alerts via email</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_enabled}
                onChange={(e) => setPreferences({ ...preferences, email_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl border flex items-center justify-between bg-white/[0.02] border-white/[0.06]">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="font-bold text-white">In-App Notifications</div>
                  <div className="text-[10px] text-slate-400">Real-time alerts inside the portal header bell bar</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.in_app_enabled}
                onChange={(e) => setPreferences({ ...preferences, in_app_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl border flex items-center justify-between bg-white/[0.02] border-white/[0.06]">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-bold text-white">Mobile Device Push Notifications</div>
                  <div className="text-[10px] text-slate-400">Push notifications on registered mobile devices</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.push_enabled}
                onChange={(e) => setPreferences({ ...preferences, push_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationModule;
