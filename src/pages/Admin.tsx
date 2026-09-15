import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getAdminUsers, updateUserRole, getAuditLogs } from "../services/api";
import { Avatar, Badge, Button, Card, EmptyState, Select, badgeTone } from "../components/ui";
import { ShieldCheck, Users, FileText, AlertTriangle, CheckCircle2, Lock, RefreshCw } from "lucide-react";
import type { AdminUser, AuditLogEntry } from "../types";

export default function Admin() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"users" | "audit">("users");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      if (tab === "users") {
        const res = await getAdminUsers();
        setUsers(res.users || []);
      } else {
        const res = await getAuditLogs();
        setAuditLogs(res.audit_logs || []);
      }
    } catch (err: any) {
      toast.error("Admin Access Error", err?.message || "Failed to load admin security data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [tab]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const res = await updateUserRole(userId, newRole);
      toast.success("Role Updated", res.message || `User role set to ${newRole}`);
      await fetchAdminData();
    } catch (err: any) {
      toast.error("Role Change Failed", err?.message || "Failed to change user role.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (user?.role?.toUpperCase() !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warnsoft text-warn mb-4">
          <Lock className="h-8 w-8" />
        </span>
        <h2 className="text-2xl font-extrabold text-ink">403 Forbidden — Admin Access Only</h2>
        <p className="mt-2 max-w-md text-sm text-mute">
          Your current account role is <span className="font-bold text-ink">{user?.role || "USER"}</span>. Administrative privileges are required to access this portal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between anim-slide-up">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Security & Administration</h1>
          <p className="mt-1 text-[14px] text-mute">Centralized Role-Based Access Control and System Audit Trail.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchAdminData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {/* Tabs Header */}
      <div className="flex gap-2 border-b border-line pb-2">
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition ${
            tab === "users" ? "bg-brandsoft text-brandink" : "text-mute hover:bg-s2 hover:text-ink"
          }`}
        >
          <Users className="h-4 w-4" />
          User Management ({users.length})
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition ${
            tab === "audit" ? "bg-brandsoft text-brandink" : "text-mute hover:bg-s2 hover:text-ink"
          }`}
        >
          <FileText className="h-4 w-4" />
          Security Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Users */}
      {tab === "users" && (
        <Card className="anim-slide-up overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-bold text-ink">System Users & Role Assignments</h2>
            <p className="text-[13px] text-mute">Manage RBAC roles for all authenticated users.</p>
          </div>
          <div className="divide-y divide-line">
            {users.map((u) => (
              <div key={u.user_id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5">
                  <Avatar name={u.display_name || u.email} size="md" />
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {u.display_name || u.email}
                      <Badge className={u.role === "ADMIN" ? badgeTone.brand : badgeTone.neutral}>{u.role}</Badge>
                      {u.mfa_verified && <Badge className={badgeTone.success}>MFA Verified</Badge>}
                    </p>
                    <p className="text-xs text-mute">{u.email} • ID: {u.user_id.slice(0, 12)}...</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                    disabled={updatingId === u.user_id}
                    className="w-36 text-xs font-medium"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="OFFICER">OFFICER</option>
                    <option value="ANALYST">ANALYST</option>
                    <option value="VIEWER">VIEWER</option>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 2: Audit Logs */}
      {tab === "audit" && (
        <Card className="anim-slide-up overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-bold text-ink">Security Audit Trail</h2>
            <p className="text-[13px] text-mute">Immutable record of security-relevant system actions.</p>
          </div>
          {auditLogs.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title="No audit logs recorded yet"
              description="Security events will be logged here automatically."
            />
          ) : (
            <div className="divide-y divide-line overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-s2 text-mute font-semibold">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User ID</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.audit_id} className="hover:bg-s2/50 transition">
                      <td className="px-4 py-3 text-mute font-sans whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">{log.user_id}</td>
                      <td className="px-4 py-3 font-bold text-brand">{log.action}</td>
                      <td className="px-4 py-3 text-mute">{log.resource_type}: {log.resource_id || "N/A"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] ${
                            log.status === "SUCCESS"
                              ? "bg-oksoft text-success"
                              : "bg-warnsoft text-warn"
                          }`}
                        >
                          {log.status === "SUCCESS" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
