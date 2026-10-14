import { type AuditLog } from "../../shared";

type Props = { auditLogs: AuditLog[] };

export default function AuditView({ auditLogs }: Props) {
  return (
    <section className="admin-module">
      <div className="module-heading">
        <p className="eyebrow">AUDIT TRAIL</p>
        <h1>审计日志</h1>
        <p>审核、撤销和恢复等管理操作均不可篡改地保留。</p>
      </div>
      <div className="audit-table">
        <div className="audit-row audit-header">
          <span>时间</span>
          <span>管理员</span>
          <span>操作</span>
          <span>对象</span>
          <span>原因</span>
        </div>
        {auditLogs.map((log) => (
          <div className="audit-row" key={log.id}>
            <time>{new Date(log.createdAt).toLocaleString("zh-CN")}</time>
            <span>{log.adminUser.displayName}</span>
            <strong>{log.action}</strong>
            <span>
              {log.targetType} #{log.targetId}
            </span>
            <span>{log.reason || "—"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
