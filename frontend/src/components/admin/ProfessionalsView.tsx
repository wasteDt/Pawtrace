import { type AdminProfessional } from "../../shared";

type Props = {
  professionalStatus: "APPROVED" | "REVOKED";
  setProfessionalStatus: (status: "APPROVED" | "REVOKED") => void;
  professionals: AdminProfessional[];
  busy: boolean;
  changeProfessionalStatus: (
    item: AdminProfessional,
    action: "REVOKE" | "RESTORE",
  ) => Promise<void>;
};

export default function ProfessionalsView({
  professionalStatus,
  setProfessionalStatus,
  professionals,
  busy,
  changeProfessionalStatus,
}: Props) {
  return (
    <section className="admin-module">
      <div className="module-heading">
        <p className="eyebrow">PROFESSIONALS</p>
        <h1>已认证人员</h1>
        <p>管理已经生效或已撤销的专业身份。身份类型不能在此直接修改。</p>
      </div>
      <nav className="admin-tabs compact-tabs">
        <button
          className={professionalStatus === "APPROVED" ? "active" : ""}
          onClick={() => setProfessionalStatus("APPROVED")}
        >
          有效身份
        </button>
        <button
          className={professionalStatus === "REVOKED" ? "active" : ""}
          onClick={() => setProfessionalStatus("REVOKED")}
        >
          已撤销
        </button>
      </nav>
      <div className="professional-admin-list">
        {professionals.length === 0 ? (
          <div className="empty-card">
            <h2>暂无记录</h2>
          </div>
        ) : (
          professionals.map((item) => (
            <article key={item.id}>
              <div className="professional-admin-avatar">
                {item.displayName.slice(0, 1)}
              </div>
              <div className="professional-admin-info">
                <div>
                  <strong>{item.displayName}</strong>
                  <span
                    className={`review-status ${item.status.toLowerCase()}`}
                  >
                    {item.status === "APPROVED" ? "认证有效" : "已撤销"}
                  </span>
                </div>
                <p>
                  {item.type === "VETERINARIAN" ? "宠物医生" : "医生助理"} ·{" "}
                  {item.organization}
                </p>
                <small>
                  {item.user.phoneNumber} · {item.specialties.join("、")}
                </small>
              </div>
              <div className="professional-admin-date">
                <span>
                  {item.status === "APPROVED" ? "认证时间" : "撤销时间"}
                </span>
                <time>
                  {new Date(
                    (item.status === "APPROVED"
                      ? item.approvedAt
                      : item.revokedAt) ?? "",
                  ).toLocaleDateString("zh-CN")}
                </time>
              </div>
              <button
                className={
                  item.status === "APPROVED"
                    ? "reject-button"
                    : "secondary-button"
                }
                disabled={busy}
                onClick={() =>
                  void changeProfessionalStatus(
                    item,
                    item.status === "APPROVED" ? "REVOKE" : "RESTORE",
                  )
                }
              >
                {item.status === "APPROVED" ? "撤销身份" : "纠错恢复"}
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
