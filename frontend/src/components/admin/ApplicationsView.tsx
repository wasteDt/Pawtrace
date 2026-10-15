import {
  type AdminApplication,
  type ProfessionalApplication,
  rejectionReasons,
} from "../../shared";

type Props = {
  applications: AdminApplication[];
  busy: boolean;
  review: (decision: "APPROVE" | "REJECT") => Promise<void>;
  reviewNote: string;
  selected: AdminApplication | null;
  setReviewNote: (value: string) => void;
  setSelected: (item: AdminApplication | null) => void;
  setStatus: (status: ProfessionalApplication["status"]) => void;
  status: ProfessionalApplication["status"];
};

export default function ApplicationsView({
  applications,
  busy,
  review,
  reviewNote,
  selected,
  setReviewNote,
  setSelected,
  setStatus,
  status,
}: Props) {
  return (
    <>
      <section className="admin-heading">
        <div>
          <p className="eyebrow">PROFESSIONAL REVIEW</p>
          <h1>专业身份认证审核</h1>
          <p>审核材料只对管理员可见，所有决定均写入审计日志。</p>
        </div>
        <strong>
          {applications.length}
          <small> 当前记录</small>
        </strong>
      </section>
      <nav className="admin-tabs">
        {(["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).map(
          (item) => (
            <button
              key={item}
              className={status === item ? "active" : ""}
              onClick={() => setStatus(item)}
            >
              {item === "PENDING"
                ? "待审核"
                : item === "APPROVED"
                  ? "已通过"
                  : item === "REJECTED"
                    ? "已驳回"
                    : "已撤销"}
            </button>
          ),
        )}
      </nav>
      {applications.length === 0 ? (
        <div className="empty-card">
          <h2>当前没有申请</h2>
          <p>切换上方状态可以查看历史记录。</p>
        </div>
      ) : (
        <div className="admin-review-layout">
          <aside className="admin-application-list">
            {applications.map((item) => (
              <button
                key={item.id}
                className={selected?.id === item.id ? "selected" : ""}
                onClick={() => {
                  setSelected(item);
                  setReviewNote("");
                }}
              >
                <span
                  className={`application-type ${item.requestedType.toLowerCase()}`}
                >
                  {item.requestedType === "VETERINARIAN"
                    ? "宠物医生"
                    : "医生助理"}
                </span>
                <strong>{item.displayName}</strong>
                <small>
                  {item.purpose === "UPGRADE" ? "助理升级医生" : "首次认证"}
                </small>
                <small>{item.organization}</small>
                <time>
                  {new Date(item.submittedAt).toLocaleString("zh-CN")}
                </time>
              </button>
            ))}
          </aside>
          {selected && (
            <article className="admin-review-card">
              <div className="review-title">
                <div>
                  <p className="eyebrow">APPLICATION #{selected.id}</p>
                  <h2>{selected.displayName}</h2>
                  <p>
                    {selected.purpose === "UPGRADE"
                      ? "医生助理升级宠物医生"
                      : selected.requestedType === "VETERINARIAN"
                        ? "宠物医生首次认证"
                        : "医生助理首次认证"}
                  </p>
                </div>
                <span
                  className={`review-status ${selected.status.toLowerCase()}`}
                >
                  {selected.status === "PENDING"
                    ? "待审核"
                    : selected.status === "APPROVED"
                      ? "已通过"
                      : selected.status === "REJECTED"
                        ? "已驳回"
                        : "已撤销"}
                </span>
              </div>
              <dl className="review-facts">
                <div>
                  <dt>提交时身份</dt>
                  <dd>
                    {selected.previousType === "ASSISTANT"
                      ? "认证医生助理"
                      : "未认证"}
                  </dd>
                </div>
                <div>
                  <dt>当前身份</dt>
                  <dd>
                    {selected.user.professional?.status === "APPROVED"
                      ? selected.user.professional.type === "VETERINARIAN"
                        ? "认证宠物医生"
                        : "认证医生助理"
                      : selected.user.professional?.status === "REVOKED"
                        ? "已撤销"
                        : "未认证"}
                  </dd>
                </div>
                <div>
                  <dt>真实姓名</dt>
                  <dd>{selected.realName}</dd>
                </div>
                <div>
                  <dt>用户昵称</dt>
                  <dd>{selected.user.profile?.nickname || "未设置"}</dd>
                </div>
                <div>
                  <dt>手机号</dt>
                  <dd>{selected.user.phoneNumber}</dd>
                </div>
                <div>
                  <dt>从业年限</dt>
                  <dd>{selected.yearsOfPractice} 年</dd>
                </div>
                <div className="wide">
                  <dt>所属机构</dt>
                  <dd>{selected.organization}</dd>
                </div>
                <div className="wide">
                  <dt>擅长领域</dt>
                  <dd>{selected.specialties.join("、")}</dd>
                </div>
                <div className="wide">
                  <dt>专业简介</dt>
                  <dd>{selected.introduction || "未填写"}</dd>
                </div>
              </dl>
              <div className="credential-review">
                <div>
                  <strong>
                    {selected.purpose === "UPGRADE"
                      ? "本次执业兽医资格证明"
                      : "认证证明材料"}
                  </strong>
                  <span>
                    {selected.credentialMedia.originalName} ·{" "}
                    {(
                      Number(selected.credentialMedia.sizeBytes) /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </span>
                </div>
                <a
                  className="secondary-button"
                  href={`/api/v1/admin/media/${selected.credentialMedia.id}/access`}
                  target="_blank"
                  rel="noreferrer"
                >
                  安全预览材料 ↗
                </a>
              </div>
              {selected.status === "PENDING" ? (
                <div className="review-actions">
                  <label>
                    审核备注 / 驳回原因
                    <div className="reason-presets">
                      {rejectionReasons.map((reason) => (
                        <button
                          type="button"
                          key={reason}
                          className={reviewNote === reason ? "selected" : ""}
                          onClick={() => setReviewNote(reason)}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={3}
                      maxLength={500}
                      placeholder="点击常用理由快速填入，也可以自行修改；驳回时必填"
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                    />
                  </label>
                  <div>
                    <button
                      className="reject-button"
                      disabled={busy}
                      onClick={() => void review("REJECT")}
                    >
                      驳回申请
                    </button>
                    <button
                      className="primary-button compact"
                      disabled={busy}
                      onClick={() => void review("APPROVE")}
                    >
                      通过并生效
                    </button>
                  </div>
                </div>
              ) : (
                <div className="review-result">
                  <strong>审核结果已记录</strong>
                  <p>
                    {selected.reviewNote || "无审核备注"}
                    {selected.reviewedBy
                      ? ` · ${selected.reviewedBy.displayName}`
                      : ""}
                  </p>
                </div>
              )}
            </article>
          )}
        </div>
      )}
    </>
  );
}
