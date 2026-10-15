import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import {
  type ProfessionalState,
  type ProfessionalDraft,
  type PublicView,
} from "../../shared";

type Props = {
  professionalState: ProfessionalState | null;
  professionalDraft: ProfessionalDraft;
  setProfessionalDraft: Dispatch<SetStateAction<ProfessionalDraft>>;
  setCredentialFile: (file: File | null) => void;
  setView: (view: PublicView) => void;
  busy: boolean;
  cancelProfessionalApplication: () => Promise<void>;
  submitProfessionalApplication: (event: FormEvent) => Promise<void>;
};

export default function ProfessionalView({
  professionalState,
  professionalDraft,
  setProfessionalDraft,
  setCredentialFile,
  setView,
  busy,
  cancelProfessionalApplication,
  submitProfessionalApplication,
}: Props) {
  const [upgradeFormOpen, setUpgradeFormOpen] = useState(false);
  const profile = professionalState?.profile;
  const application = professionalState?.application;
  const approved = profile?.status === "APPROVED";
  const assistant = approved && profile.type === "ASSISTANT";
  const pending = application?.status === "PENDING";
  const showForm =
    !pending &&
    (!profile ||
      (!approved && profile.status !== "REVOKED") ||
      (assistant && upgradeFormOpen));

  useEffect(() => {
    setUpgradeFormOpen(false);
  }, [application?.id, application?.status]);

  function openUpgradeForm() {
    if (!profile || profile.type !== "ASSISTANT") return;
    setProfessionalDraft({
      requestedType: "VETERINARIAN",
      realName: profile.realName,
      displayName: profile.displayName,
      organization: profile.organization,
      yearsOfPractice: String(profile.yearsOfPractice),
      specialties: profile.specialties.join("，"),
      introduction: profile.introduction ?? "",
    });
    setCredentialFile(null);
    setUpgradeFormOpen(true);
  }

  return (
    <section className="professional-page">
      <div className="page-heading">
        <div>
          <button className="back-button" onClick={() => setView("home")}>
            ← 返回首页
          </button>
          <p className="eyebrow">PROFESSIONAL IDENTITY</p>
          <h1>专业身份认证</h1>
          <p>认证后仍保留全部宠物主人功能，并解锁对应专业能力。</p>
        </div>
      </div>
      {approved && profile && (
        <div className="status-card approved">
          <span className="status-mark">✓</span>
          <div>
            <p className="eyebrow">VERIFIED</p>
            <h2>
              {profile.type === "VETERINARIAN"
                ? "认证宠物医生"
                : "认证医生助理"}
            </h2>
            <p>
              {profile.displayName}
              ，你的专业身份已经生效。
            </p>
            {assistant && !pending && !upgradeFormOpen && (
              <button className="secondary-button" onClick={openUpgradeForm}>
                {application?.purpose === "UPGRADE" &&
                application.status === "REJECTED"
                  ? "重新申请升级为宠物医生"
                  : "申请升级为宠物医生"}
              </button>
            )}
          </div>
        </div>
      )}
      {profile?.status === "REVOKED" && (
        <div className="status-card pending">
          <h2>专业身份已撤销</h2>
          <p>升级申请不可继续；重新认证将通过独立流程办理。</p>
        </div>
      )}
      {assistant &&
        application?.purpose === "UPGRADE" &&
        application.status === "REJECTED" &&
        !upgradeFormOpen && (
          <div className="review-rejected">
            上次升级未通过：{application.reviewNote || "请检查资料后重新提交"}
          </div>
        )}
      {pending && application && (
        <div className="status-card pending">
          <span className="status-mark">⌛</span>
          <div>
            <p className="eyebrow">UNDER REVIEW</p>
            <h2>
              {application.purpose === "UPGRADE"
                ? "升级申请审核中"
                : "认证资料审核中"}
            </h2>
            {assistant && (
              <p>当前医生助理身份继续有效，审核通过后才切换为宠物医生。</p>
            )}
            <p>
              申请身份：
              {application.requestedType === "VETERINARIAN"
                ? "宠物医生"
                : "医生助理"}{" "}
              · {application.organization}
            </p>
            <p className="status-note">
              证明材料：
              {application.credentialMedia.originalName}
            </p>
            <button
              className="danger-link"
              onClick={() => void cancelProfessionalApplication()}
            >
              {application.purpose === "UPGRADE" ? "撤回升级申请" : "撤销申请"}
            </button>
          </div>
        </div>
      )}
      {showForm && (
        <div className="professional-layout">
          <aside className="identity-choice">
            {assistant ? (
              <div className="status-note">
                升级目标：宠物医生。审核期间保留医生助理身份，需重新上传执业兽医资格证。
              </div>
            ) : (
              <>
                <button
                  className={
                    professionalDraft.requestedType === "VETERINARIAN"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setProfessionalDraft({
                      ...professionalDraft,
                      requestedType: "VETERINARIAN",
                    })
                  }
                >
                  <strong>宠物医生</strong>
                  <span>需上传执业兽医资格证</span>
                  <small>
                    可回答健康问题、接收个人提问、使用病例库及学术论坛
                  </small>
                </button>
                <button
                  className={
                    professionalDraft.requestedType === "ASSISTANT"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setProfessionalDraft({
                      ...professionalDraft,
                      requestedType: "ASSISTANT",
                    })
                  }
                >
                  <strong>医生助理</strong>
                  <span>需上传相关专业学历证明</span>
                  <small>可使用病例库及学术论坛，不提供正式医生回答</small>
                </button>
              </>
            )}
          </aside>
          <form
            className="professional-form"
            onSubmit={submitProfessionalApplication}
          >
            <div>
              <h2>{assistant ? "申请升级为宠物医生" : "填写认证资料"}</h2>
              <p>真实姓名和证明材料仅用于审核，不会在公开主页展示。</p>
              {assistant && (
                <p>
                  通过后身份将切换为宠物医生；驳回或撤回不影响当前医生助理身份。
                </p>
              )}
            </div>
            {professionalState?.application?.status === "REJECTED" && (
              <div className="review-rejected">
                上次申请未通过：
                {professionalState.application.reviewNote ||
                  "请检查资料后重新提交"}
              </div>
            )}
            <div className="form-grid">
              <label>
                真实姓名
                <input
                  required
                  maxLength={80}
                  value={professionalDraft.realName}
                  onChange={(event) =>
                    setProfessionalDraft({
                      ...professionalDraft,
                      realName: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                公开展示名称
                <input
                  required
                  maxLength={80}
                  placeholder="例如：王医生"
                  value={professionalDraft.displayName}
                  onChange={(event) =>
                    setProfessionalDraft({
                      ...professionalDraft,
                      displayName: event.target.value,
                    })
                  }
                />
              </label>
              <label className="full">
                所属医院或机构
                <input
                  required
                  maxLength={150}
                  value={professionalDraft.organization}
                  onChange={(event) =>
                    setProfessionalDraft({
                      ...professionalDraft,
                      organization: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                从业年限
                <input
                  required
                  type="number"
                  min="0"
                  max="80"
                  value={professionalDraft.yearsOfPractice}
                  onChange={(event) =>
                    setProfessionalDraft({
                      ...professionalDraft,
                      yearsOfPractice: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                擅长领域
                <input
                  required
                  placeholder="用逗号分隔，如：猫科，内科"
                  value={professionalDraft.specialties}
                  onChange={(event) =>
                    setProfessionalDraft({
                      ...professionalDraft,
                      specialties: event.target.value,
                    })
                  }
                />
              </label>
              <label className="full">
                专业简介
                <textarea
                  maxLength={1000}
                  rows={4}
                  value={professionalDraft.introduction}
                  onChange={(event) =>
                    setProfessionalDraft({
                      ...professionalDraft,
                      introduction: event.target.value,
                    })
                  }
                />
              </label>
              <label className="full credential-field">
                {professionalDraft.requestedType === "VETERINARIAN"
                  ? "执业兽医资格证"
                  : "相关专业学历证明"}
                <input
                  required
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) =>
                    setCredentialFile(event.target.files?.[0] ?? null)
                  }
                />
                <span>
                  支持 JPG、PNG、WebP 或 PDF，最大 10 MB。材料将私密存储。
                </span>
              </label>
            </div>
            <button className="primary-button" disabled={busy}>
              {busy
                ? "正在上传并提交…"
                : assistant
                  ? "提交升级申请"
                  : "提交认证申请"}
            </button>
            {assistant && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setUpgradeFormOpen(false)}
              >
                暂不升级
              </button>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
