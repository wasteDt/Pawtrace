import { type FormEvent, useEffect, useState } from "react";
import { useAdminNotifications } from "../hooks/useAdminNotifications";
import AdminLoginView from "../components/auth/AdminLoginView";
import ApplicationsView from "../components/admin/ApplicationsView";
import DashboardView from "../components/admin/DashboardView";
import AdminNotificationsView from "../components/admin/AdminNotificationsView";
import ProfessionalsView from "../components/admin/ProfessionalsView";
import AuditView from "../components/admin/AuditView";
import {
  type AdminSession,
  type AdminApplication,
  type AdminPage,
  type AdminDashboard,
  type AdminProfessional,
  type AuditLog,
  type Notification,
  type ProfessionalApplication,
  rejectionReasons,
  adminPageNames,
  json,
} from "../shared";

export default function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [status, setStatus] =
    useState<ProfessionalApplication["status"]>("PENDING");
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [adminPage, setAdminPage] = useState<AdminPage>(() => {
    const page = window.location.hash.replace("#", "") as AdminPage;
    return [
      "dashboard",
      "notifications",
      "applications",
      "professionals",
      "users",
      "content",
      "reports",
      "operations",
      "audit",
      "settings",
    ].includes(page)
      ? page
      : "dashboard";
  });
  const {
    adminNotifications,
    adminUnreadCount,
    adminInboxOpen,
    readAdminNotification,
    readAllAdminNotifications,
    deleteAdminNotification,
    clearReadAdminNotifications,
    setAdminInboxOpen,
  } = useAdminNotifications(
    session,
    () => setAdminPage("applications"),
    (title) => {
      setMessage(title);
      void loadDashboard();
    },
  );

  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [professionalStatus, setProfessionalStatus] = useState<
    "APPROVED" | "REVOKED"
  >("APPROVED");
  const [professionals, setProfessionals] = useState<AdminProfessional[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetch("/api/v1/admin/auth/session", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => result && setSession(result.data as AdminSession))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    if (adminPage === "applications") void loadApplications(status);
    if (adminPage === "dashboard") void loadDashboard();
    if (adminPage === "professionals")
      void loadProfessionals(professionalStatus);
    if (adminPage === "audit") void loadAuditLogs();
  }, [session, status, adminPage, professionalStatus]);

  useEffect(() => {
    window.history.replaceState(null, "", `/admin#${adminPage}`);
  }, [adminPage]);

  async function loadDashboard() {
    try {
      const result = await json<{ data: AdminDashboard }>(
        await fetch("/api/v1/admin/dashboard", { credentials: "include" }),
      );
      setDashboard(result.data);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "工作台加载失败");
    }
  }

  async function loadProfessionals(nextStatus: "APPROVED" | "REVOKED") {
    try {
      const result = await json<{ data: AdminProfessional[] }>(
        await fetch(`/api/v1/admin/professionals?status=${nextStatus}`, {
          credentials: "include",
        }),
      );
      setProfessionals(result.data);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "认证人员加载失败");
    }
  }

  async function loadAuditLogs() {
    try {
      const result = await json<{ data: AuditLog[] }>(
        await fetch("/api/v1/admin/audit-logs", { credentials: "include" }),
      );
      setAuditLogs(result.data);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "审计日志加载失败");
    }
  }

  async function changeProfessionalStatus(
    item: AdminProfessional,
    action: "REVOKE" | "RESTORE",
  ) {
    if (!session) return;
    const reason = window.prompt(
      action === "REVOKE"
        ? "请输入撤销原因（将通知用户）："
        : "请输入恢复原因（将通知用户）：",
    );
    if (!reason?.trim()) return;
    if (
      !window.confirm(
        action === "REVOKE"
          ? "确认撤销该专业身份？专业权限将立即失效。"
          : "确认恢复该专业身份？专业权限将立即生效。",
      )
    )
      return;
    setBusy(true);
    try {
      await json(
        await fetch(`/api/v1/admin/professionals/${item.userId}/status`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({ action, reason }),
        }),
      );
      setMessage(action === "REVOKE" ? "专业身份已撤销" : "专业身份已恢复");
      await loadProfessionals(professionalStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await json<{ data: AdminSession }>(
        await fetch("/api/v1/admin/auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }),
      );
      setSession(result.data);
      setPassword("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function loadApplications(
    nextStatus: ProfessionalApplication["status"],
  ) {
    try {
      const result = await json<{ data: AdminApplication[] }>(
        await fetch(
          `/api/v1/admin/professional-applications?status=${nextStatus}`,
          { credentials: "include" },
        ),
      );
      setApplications(result.data);
      setSelected((current) =>
        current && result.data.some((item) => item.id === current.id)
          ? current
          : (result.data[0] ?? null),
      );
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "加载失败");
    }
  }

  async function review(decision: "APPROVE" | "REJECT") {
    if (!session || !selected) return;
    if (decision === "REJECT" && !reviewNote.trim()) {
      setMessage("驳回时请填写明确原因");
      return;
    }
    if (
      !window.confirm(
        decision === "APPROVE"
          ? selected.purpose === "UPGRADE"
            ? "确认通过助理升级申请？身份将立即切换为宠物医生。"
            : "确认通过该认证申请？身份将立即生效。"
          : "确认驳回该认证申请？",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await json(
        await fetch(
          `/api/v1/admin/professional-applications/${selected.id}/review`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": session.csrfToken,
            },
            body: JSON.stringify({ decision, reviewNote }),
          },
        ),
      );
      setReviewNote("");
      setMessage(
        decision === "APPROVE" ? "认证已通过，专业身份已生效" : "申请已驳回",
      );
      await loadApplications(status);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "审核失败");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/v1/admin/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setSession(null);
    setApplications([]);
    setSelected(null);
  }

  if (checking)
    return (
      <main className="loading-page">
        <span className="loading-dot" />
        正在进入管理端…
      </main>
    );
  if (!session)
    return (
      <AdminLoginView
        busy={busy}
        login={login}
        message={message}
        password={password}
        setPassword={setPassword}
        username={username}
        setUsername={setUsername}
      />
    );

  return (
    <main className="admin-shell">
      {message && (
        <div className="toast" role="alert">
          {message}
        </div>
      )}
      <header className="admin-topbar">
        <div>
          <a className="brand" href="/">
            <span className="brand-mark">P</span>Pawtrace
          </a>
          <span className="admin-badge">管理端</span>
        </div>
        <div>
          <div className="inbox-menu">
            <button
              className="inbox-button"
              aria-label={`管理员通知，${adminUnreadCount} 条未读`}
              onClick={() => setAdminInboxOpen((open) => !open)}
            >
              ✉
              {adminUnreadCount > 0 && (
                <span>{adminUnreadCount > 99 ? "99+" : adminUnreadCount}</span>
              )}
            </button>
            {adminInboxOpen && (
              <div className="inbox-popover">
                <div className="inbox-head">
                  <div>
                    <strong>工作通知</strong>
                    <span>{adminUnreadCount} 条未读</span>
                  </div>
                  <button onClick={() => void readAllAdminNotifications()}>
                    全部已读
                  </button>
                </div>
                <div className="inbox-list">
                  {adminNotifications.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      className={item.readAt ? "" : "unread"}
                      onClick={() => void readAdminNotification(item)}
                    >
                      <span className="inbox-dot" />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.content}</p>
                        <time>
                          {new Date(item.createdAt).toLocaleString("zh-CN")}
                        </time>
                      </div>
                    </button>
                  ))}
                  {adminNotifications.length === 0 && (
                    <div className="inbox-empty">暂时没有工作通知</div>
                  )}
                </div>
                <button
                  className="inbox-all-button"
                  onClick={() => {
                    setAdminPage("notifications");
                    setAdminInboxOpen(false);
                  }}
                >
                  查看全部通知
                </button>
              </div>
            )}
          </div>
          <span>{session.admin.displayName}</span>
          <button className="secondary-button" onClick={() => void logout()}>
            退出
          </button>
        </div>
      </header>
      <div className="admin-console-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title">平台管理</div>
          <button
            className={adminPage === "notifications" ? "active" : ""}
            onClick={() => setAdminPage("notifications")}
          >
            <span>✉</span>通知中心
            {adminUnreadCount > 0 && (
              <b className="sidebar-count">{adminUnreadCount}</b>
            )}
          </button>
          {(
            [
              ["dashboard", "▦", "工作台"],
              ["applications", "✓", "认证申请"],
              ["professionals", "✦", "已认证人员"],
              ["users", "♙", "用户管理"],
              ["content", "▤", "内容治理"],
              ["reports", "!", "举报中心"],
              ["operations", "◇", "运营管理"],
              ["audit", "◷", "审计日志"],
              ["settings", "⚙", "系统设置"],
            ] as Array<[AdminPage, string, string]>
          ).map(([page, icon, label]) => (
            <button
              key={page}
              className={adminPage === page ? "active" : ""}
              onClick={() => setAdminPage(page)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </aside>
        <div className="admin-main-content">
          {adminPage === "notifications" && (
            <AdminNotificationsView
              adminUnreadCount={adminUnreadCount}
              adminNotifications={adminNotifications}
              readAllAdminNotifications={readAllAdminNotifications}
              clearReadAdminNotifications={clearReadAdminNotifications}
              readAdminNotification={readAdminNotification}
              deleteAdminNotification={deleteAdminNotification}
            />
          )}
          {adminPage === "dashboard" && (
            <DashboardView dashboard={dashboard} setAdminPage={setAdminPage} />
          )}
          {adminPage === "professionals" && (
            <ProfessionalsView
              professionalStatus={professionalStatus}
              setProfessionalStatus={setProfessionalStatus}
              professionals={professionals}
              busy={busy}
              changeProfessionalStatus={changeProfessionalStatus}
            />
          )}
          {adminPage === "audit" && <AuditView auditLogs={auditLogs} />}
          {["users", "content", "reports", "operations", "settings"].includes(
            adminPage,
          ) && (
            <section className="admin-module planned-module">
              <span>◇</span>
              <h1>{adminPageNames[adminPage]}</h1>
              <p>该模块已经纳入后台信息架构，将在对应业务功能开发时启用。</p>
            </section>
          )}
          {adminPage === "applications" && (
            <ApplicationsView
              applications={applications}
              busy={busy}
              review={review}
              reviewNote={reviewNote}
              selected={selected}
              setReviewNote={setReviewNote}
              setSelected={setSelected}
              setStatus={setStatus}
              status={status}
            />
          )}
        </div>
      </div>
    </main>
  );
}
