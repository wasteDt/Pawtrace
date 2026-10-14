import { type AdminDashboard, type AdminPage } from "../../shared";

type Props = {
  dashboard: AdminDashboard | null;
  setAdminPage: (page: AdminPage) => void;
};

export default function DashboardView({ dashboard, setAdminPage }: Props) {
  return (
    <section className="admin-module">
      <div className="module-heading">
        <p className="eyebrow">OVERVIEW</p>
        <h1>管理工作台</h1>
        <p>查看当前治理待办和专业身份概况。</p>
      </div>
      <div className="admin-metric-grid">
        <button onClick={() => setAdminPage("applications")}>
          <span>待审核申请</span>
          <strong>{dashboard?.pendingApplications ?? "—"}</strong>
          <small>进入认证审核 →</small>
        </button>
        <button onClick={() => setAdminPage("professionals")}>
          <span>有效专业身份</span>
          <strong>{dashboard?.approvedProfessionals ?? "—"}</strong>
          <small>查看认证人员 →</small>
        </button>
        <div>
          <span>已撤销身份</span>
          <strong>{dashboard?.revokedProfessionals ?? "—"}</strong>
          <small>需要时可纠错恢复</small>
        </div>
        <button onClick={() => setAdminPage("audit")}>
          <span>今日管理操作</span>
          <strong>{dashboard?.todayActions ?? "—"}</strong>
          <small>查看审计日志 →</small>
        </button>
      </div>
    </section>
  );
}
