import { type FormEvent, useEffect, useState } from "react";

type User = {
  id: number;
  nickname: string | null;
  avatarUrl: string | null;
  profileCompleted: boolean;
};
type SessionData = { csrfToken: string; user: User };
type ApiError = { error?: { message?: string } };
type Pet = {
  id: number;
  name: string;
  species: "CAT" | "DOG" | "OTHER";
  customSpecies: string | null;
  breed: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate: string | null;
  ageText: string | null;
  weightKg: number | null;
  neutered: boolean | null;
  allergies: string | null;
  pastDiseases: string | null;
  vaccinationInfo: string | null;
  dewormingInfo: string | null;
  note: string | null;
};
type History = {
  id: number;
  recordDate: string;
  title: string;
  description: string;
  hospitalName: string | null;
  doctorName: string | null;
  treatment: string | null;
};
type PetDraft = Omit<Pet, "id">;
type ProfessionalApplication = {
  id: number;
  requestedType: "VETERINARIAN" | "ASSISTANT";
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  displayName: string;
  organization: string;
  reviewNote: string | null;
  submittedAt: string;
  credentialMedia: { id: number; originalName: string };
};
type ProfessionalState = {
  profile: {
    type: "VETERINARIAN" | "ASSISTANT";
    status: string;
    displayName: string;
  } | null;
  application: ProfessionalApplication | null;
};
type AdminSession = {
  csrfToken: string;
  admin: { id: number; username: string; displayName: string };
};
type AdminApplication = ProfessionalApplication & {
  realName: string;
  yearsOfPractice: number;
  specialties: string[];
  introduction: string | null;
  reviewedAt: string | null;
  user: {
    id: number;
    phoneNumber: string;
    profile: { nickname: string | null } | null;
  };
  credentialMedia: {
    id: number;
    originalName: string;
    mimeType: string;
    sizeBytes: string | number;
  };
  reviewedBy: { displayName: string } | null;
};
type AdminPage =
  | "dashboard"
  | "notifications"
  | "applications"
  | "professionals"
  | "users"
  | "content"
  | "reports"
  | "operations"
  | "audit"
  | "settings";
type AdminDashboard = {
  pendingApplications: number;
  approvedProfessionals: number;
  revokedProfessionals: number;
  todayActions: number;
};
type AdminProfessional = {
  id: number;
  userId: number;
  type: "VETERINARIAN" | "ASSISTANT";
  status: "APPROVED" | "REVOKED";
  realName: string;
  displayName: string;
  organization: string;
  yearsOfPractice: number;
  specialties: string[];
  approvedAt: string | null;
  revokedAt: string | null;
  user: {
    id: number;
    phoneNumber: string;
    profile: { nickname: string | null } | null;
    applications: Array<{
      id: number;
      requestedType: string;
      status: string;
      submittedAt: string;
      reviewedAt: string | null;
      reviewNote: string | null;
    }>;
  };
};
type AuditLog = {
  id: number;
  action: string;
  targetType: string;
  targetId: number;
  reason: string | null;
  createdAt: string;
  adminUser: { displayName: string };
};
type Notification = {
  id: number;
  type: string;
  title: string;
  content: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};
const emptyPet: PetDraft = {
  name: "",
  species: "CAT",
  customSpecies: null,
  breed: null,
  gender: "UNKNOWN",
  birthDate: null,
  ageText: "",
  weightKg: null,
  neutered: null,
  allergies: null,
  pastDiseases: null,
  vaccinationInfo: null,
  dewormingInfo: null,
  note: null,
};
const rejectionReasons = [
  "证明材料不清晰或关键信息无法辨认，请重新上传清晰完整的材料。",
  "提交的证明材料与申请身份不匹配，请核对后重新申请。",
  "证明材料信息不完整，请补充包含姓名、证书编号等关键信息的页面。",
  "申请资料中的姓名或所属机构与证明材料不一致，请修改后重新提交。",
  "证明材料已过期或无法确认有效性，请上传当前有效的证明。",
];
const adminPageNames: Record<AdminPage, string> = {
  dashboard: "工作台",
  notifications: "通知中心",
  applications: "认证申请",
  professionals: "已认证人员",
  users: "用户管理",
  content: "内容治理",
  reports: "举报中心",
  operations: "运营管理",
  audit: "审计日志",
  settings: "系统设置",
};

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & ApiError;
  if (!response.ok)
    throw new Error(body.error?.message ?? "请求失败，请稍后重试");
  return body;
}

function PublicApp() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [checking, setChecking] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [view, setView] = useState<"home" | "pets" | "professional">("home");
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [petFormOpen, setPetFormOpen] = useState(false);
  const [petDraft, setPetDraft] = useState<PetDraft>(emptyPet);
  const [editingPetId, setEditingPetId] = useState<number | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [histories, setHistories] = useState<History[]>([]);
  const [historyFormOpen, setHistoryFormOpen] = useState(false);
  const [historyDraft, setHistoryDraft] = useState({
    recordDate: new Date().toISOString().slice(0, 10),
    title: "",
    description: "",
    hospitalName: "",
    doctorName: "",
    treatment: "",
  });
  const [professionalState, setProfessionalState] =
    useState<ProfessionalState | null>(null);
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [professionalDraft, setProfessionalDraft] = useState({
    requestedType: "VETERINARIAN" as "VETERINARIAN" | "ASSISTANT",
    realName: "",
    displayName: "",
    organization: "",
    yearsOfPractice: "",
    specialties: "",
    introduction: "",
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<
    "all" | "unread" | "professional" | "system"
  >("all");

  useEffect(() => {
    fetch("/api/v1/auth/session", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => result && setSession(result.data as SessionData))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (session?.user.profileCompleted && view === "pets") void loadPets();
  }, [session?.user.profileCompleted, view]);

  useEffect(() => {
    if (session?.user.profileCompleted && view === "professional")
      void loadProfessionalState();
  }, [session?.user.profileCompleted, view]);

  useEffect(() => {
    if (!session?.user.profileCompleted) return;
    void loadNotifications();
    const stream = new EventSource("/api/v1/me/notifications/stream", {
      withCredentials: true,
    });
    stream.addEventListener("notification", (event) => {
      const notification = JSON.parse(
        (event as MessageEvent).data,
      ) as Notification;
      setNotifications((items) => [
        notification,
        ...items.filter((item) => item.id !== notification.id),
      ]);
      setUnreadCount((count) => count + 1);
      setMessage(notification.title);
      void loadProfessionalState();
    });
    return () => stream.close();
  }, [session?.user.id, session?.user.profileCompleted]);

  async function loadNotifications(
    filter: "all" | "unread" | "professional" | "system" = notificationFilter,
  ) {
    try {
      const result = await json<{
        data: { notifications: Notification[]; unreadCount: number };
      }>(
        await fetch(`/api/v1/me/notifications?filter=${filter}`, {
          credentials: "include",
        }),
      );
      setNotifications(result.data.notifications);
      setUnreadCount(result.data.unreadCount);
    } catch {
      /* 收件箱失败不阻断主页面 */
    }
  }

  async function readNotification(notification: Notification) {
    if (!session) return;
    if (!notification.readAt) {
      const response = await fetch(
        `/api/v1/me/notifications/${notification.id}/read`,
        {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": session.csrfToken },
        },
      );
      if (response.ok) {
        setNotifications((items) =>
          items.map((item) =>
            item.id === notification.id
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          ),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    }
    if (notification.link?.includes("professional")) {
      setView("professional");
      setInboxOpen(false);
    }
  }

  async function readAllNotifications() {
    if (!session || unreadCount === 0) return;
    const response = await fetch("/api/v1/me/notifications/read-all", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": session.csrfToken },
    });
    if (response.ok) {
      const readAt = new Date().toISOString();
      setNotifications((items) =>
        items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
      );
      setUnreadCount(0);
    }
  }

  async function deleteNotification(id: number) {
    if (!session) return;
    const item = notifications.find((value) => value.id === id);
    const response = await fetch(`/api/v1/me/notifications/item/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": session.csrfToken },
    });
    if (response.ok) {
      setNotifications((items) => items.filter((value) => value.id !== id));
      if (item && !item.readAt)
        setUnreadCount((count) => Math.max(0, count - 1));
    }
  }

  async function clearReadNotifications() {
    if (!session || !window.confirm("清理所有已读消息？未读消息会保留。"))
      return;
    const response = await fetch("/api/v1/me/notifications/read", {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": session.csrfToken },
    });
    if (response.ok)
      setNotifications((items) => items.filter((item) => !item.readAt));
  }

  async function loadPets() {
    setPetsLoading(true);
    try {
      const result = await json<{ data: Pet[] }>(
        await fetch("/api/v1/pets", { credentials: "include" }),
      );
      setPets(result.data);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "宠物档案加载失败");
    } finally {
      setPetsLoading(false);
    }
  }

  async function openPetDetail(pet: Pet) {
    setSelectedPet(pet);
    setHistories([]);
    try {
      const result = await json<{ data: History[] }>(
        await fetch(`/api/v1/pets/${pet.id}/histories`, {
          credentials: "include",
        }),
      );
      setHistories(result.data);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "病史加载失败");
    }
  }

  function openCreatePet() {
    setPetDraft(emptyPet);
    setEditingPetId(null);
    setPetFormOpen(true);
  }
  function openEditPet(pet: Pet) {
    const { id, ...draft } = pet;
    setPetDraft({ ...draft, birthDate: draft.birthDate?.slice(0, 10) ?? null });
    setEditingPetId(id);
    setPetFormOpen(true);
  }

  async function savePet(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    try {
      await json(
        await fetch(
          editingPetId ? `/api/v1/pets/${editingPetId}` : "/api/v1/pets",
          {
            method: editingPetId ? "PATCH" : "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": session.csrfToken,
            },
            body: JSON.stringify(petDraft),
          },
        ),
      );
      setPetFormOpen(false);
      setMessage(editingPetId ? "宠物档案已更新" : "宠物档案已创建");
      await loadPets();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "宠物档案保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function removePet(pet: Pet) {
    if (
      !session ||
      !window.confirm(`确定停用“${pet.name}”的档案吗？历史数据将被保留。`)
    )
      return;
    try {
      const response = await fetch(`/api/v1/pets/${pet.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      if (!response.ok) await json(response);
      setSelectedPet(null);
      setMessage("宠物档案已停用");
      await loadPets();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "操作失败");
    }
  }

  async function saveHistory(event: FormEvent) {
    event.preventDefault();
    if (!session || !selectedPet) return;
    setBusy(true);
    try {
      await json(
        await fetch(`/api/v1/pets/${selectedPet.id}/histories`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify(historyDraft),
        }),
      );
      setHistoryFormOpen(false);
      setHistoryDraft({
        recordDate: new Date().toISOString().slice(0, 10),
        title: "",
        description: "",
        hospitalName: "",
        doctorName: "",
        treatment: "",
      });
      setMessage("宠物病史已记录");
      await openPetDetail(selectedPet);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "病史保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function loadProfessionalState() {
    try {
      const result = await json<{ data: ProfessionalState }>(
        await fetch("/api/v1/me/professional-profile", {
          credentials: "include",
        }),
      );
      setProfessionalState(result.data);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "认证状态加载失败");
    }
  }

  async function submitProfessionalApplication(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    if (!credentialFile) {
      setMessage("请上传对应的资格或学历证明材料");
      return;
    }
    setBusy(true);
    try {
      const mediaForm = new FormData();
      mediaForm.append("file", credentialFile);
      const media = await json<{ data: { id: number } }>(
        await fetch("/api/v1/media/credentials", {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": session.csrfToken },
          body: mediaForm,
        }),
      );
      await json(
        await fetch("/api/v1/professional-applications", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({
            ...professionalDraft,
            yearsOfPractice: Number(professionalDraft.yearsOfPractice),
            specialties: professionalDraft.specialties
              .split(/[，,]/)
              .map((item) => item.trim())
              .filter(Boolean),
            credentialMediaId: media.data.id,
          }),
        }),
      );
      setCredentialFile(null);
      setMessage("专业身份认证申请已提交");
      await loadProfessionalState();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "认证申请提交失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancelProfessionalApplication() {
    if (
      !session ||
      !professionalState?.application ||
      !window.confirm("确定撤销当前认证申请吗？")
    )
      return;
    try {
      const response = await fetch(
        `/api/v1/professional-applications/${professionalState.application.id}/cancel`,
        {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": session.csrfToken },
        },
      );
      if (!response.ok) await json(response);
      setMessage("认证申请已撤销");
      await loadProfessionalState();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "撤销失败");
    }
  }

  async function requestCode() {
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      setMessage("请输入正确的 11 位中国大陆手机号");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await json<{ data: { demoCode: string } }>(
        await fetch("/api/v1/auth/verification-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            countryCode: "+86",
            phoneNumber,
            purpose: "LOGIN",
          }),
        }),
      );
      setDemoCode(result.data.demoCode);
      setMessage("模拟验证码已生成，有效期 5 分钟。");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "验证码获取失败");
    } finally {
      setBusy(false);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      setMessage("请输入正确的 11 位中国大陆手机号");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setMessage("请输入 6 位短信验证码");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await json<{ data: SessionData }>(
        await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ countryCode: "+86", phoneNumber, code }),
        }),
      );
      setSession(result.data);
      setNickname(result.data.user.nickname ?? "");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setMessage("");
    try {
      await json(
        await fetch("/api/v1/me/profile", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({ nickname }),
        }),
      );
      setSession({
        ...session,
        user: { ...session.user, nickname, profileCompleted: true },
      });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "资料保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setSession(null);
    setCode("");
    setDemoCode("");
    setMessage("");
  }

  if (checking)
    return (
      <main className="loading-page">
        <span className="loading-dot" />
        正在恢复登录状态
      </main>
    );

  if (!session)
    return (
      <main className="auth-page">
        {message && (
          <div className="toast" role="alert">
            {message}
          </div>
        )}
        <section className="brand-panel">
          <a className="brand" href="#top">
            <span className="brand-mark">P</span>Pawtrace
          </a>
          <div className="brand-copy">
            <p className="eyebrow">PET HEALTH COMMUNITY</p>
            <h1>
              让每一次关心，
              <br />
              都有专业回应。
            </h1>
            <p>连接宠物主人与专业兽医，记录健康轨迹，沉淀可信的医学交流。</p>
          </div>
          <div className="trust-row">
            <span>宠物健康档案</span>
            <span>认证专业身份</span>
            <span>隐私问答</span>
          </div>
        </section>
        <section className="auth-panel">
          <form className="auth-card" onSubmit={login}>
            <div>
              <p className="eyebrow">WELCOME</p>
              <h2>手机号登录</h2>
              <p className="muted">未注册的手机号将自动创建账户</p>
            </div>
            <label>
              手机号
              <div className="phone-field">
                <span>+86</span>
                <input
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="请输入手机号"
                  value={phoneNumber}
                  onChange={(event) =>
                    setPhoneNumber(event.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
            </label>
            <label>
              验证码
              <div className="code-field">
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 位验证码"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                />
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => void requestCode()}
                >
                  获取验证码
                </button>
              </div>
            </label>
            {demoCode && (
              <div className="demo-code">
                <span>模拟短信验证码</span>
                <strong>{demoCode}</strong>
              </div>
            )}
            <button className="primary-button" disabled={busy}>
              {busy ? "请稍候…" : "登录 / 自动注册"}
            </button>
            <p className="agreement">
              登录即表示你同意服务条款与隐私政策。本项目当前使用模拟短信。
            </p>
          </form>
        </section>
      </main>
    );

  if (!session.user.profileCompleted)
    return (
      <main className="onboarding-page">
        <form className="profile-card" onSubmit={saveProfile}>
          <span className="step">1 / 1</span>
          <p className="eyebrow">CREATE PROFILE</p>
          <h1>先认识一下你</h1>
          <p className="muted">
            所有用户默认拥有宠物主人身份，之后可以申请医生或医生助理认证。
          </p>
          <label>
            你的昵称
            <input
              autoFocus
              maxLength={50}
              placeholder="例如：豆豆家长"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>
          {message && <p className="form-message">{message}</p>}
          <button
            className="primary-button"
            disabled={busy || nickname.trim().length < 2}
          >
            {busy ? "保存中…" : "进入 Pawtrace"}
          </button>
        </form>
      </main>
    );

  return (
    <main className="app-shell">
      {message && (
        <div className="toast" role="alert">
          {message}
        </div>
      )}
      <header className="topbar">
        <button className="brand brand-button" onClick={() => setView("home")}>
          <span className="brand-mark">P</span>Pawtrace
        </button>
        <nav>
          <button
            className={view === "home" ? "active" : ""}
            onClick={() => setView("home")}
          >
            首页
          </button>
          <button>健康问答</button>
          <button>发现</button>
        </nav>
        <div className="top-actions">
          <button className="publish-button">＋ 发布</button>
          <div className="inbox-menu">
            <button
              className="inbox-button"
              aria-label={`收件箱，${unreadCount} 条未读消息`}
              aria-expanded={inboxOpen}
              onClick={() => {
                setInboxOpen((open) => !open);
                setAccountMenuOpen(false);
              }}
            >
              ✉
              {unreadCount > 0 && (
                <span>{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>
            {inboxOpen && (
              <div className="inbox-popover">
                <div className="inbox-head">
                  <div>
                    <strong>收件箱</strong>
                    <span>{unreadCount} 条未读</span>
                  </div>
                  <button onClick={() => void readAllNotifications()}>
                    全部已读
                  </button>
                </div>
                <div className="inbox-list">
                  {notifications.length === 0 ? (
                    <div className="inbox-empty">暂时没有消息</div>
                  ) : (
                    notifications.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        className={item.readAt ? "" : "unread"}
                        onClick={() => void readNotification(item)}
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
                    ))
                  )}
                </div>
                <button
                  className="inbox-all-button"
                  onClick={() => {
                    setNotificationCenterOpen(true);
                    setInboxOpen(false);
                  }}
                >
                  查看全部消息
                </button>
              </div>
            )}
          </div>
          <div className="account-menu">
            <button
              className="avatar-button"
              aria-label="打开个人菜单"
              aria-expanded={accountMenuOpen}
              onClick={() => {
                setAccountMenuOpen((open) => !open);
                setInboxOpen(false);
              }}
            >
              {session.user.nickname?.slice(0, 1)}
            </button>
            {accountMenuOpen && (
              <div className="account-popover">
                <div className="account-summary">
                  <strong>{session.user.nickname}</strong>
                  <span>
                    {professionalState?.profile?.status === "APPROVED"
                      ? professionalState.profile.type === "VETERINARIAN"
                        ? "认证宠物医生"
                        : "认证医生助理"
                      : "宠物主人"}
                  </span>
                </div>
                <button>个人主页</button>
                <button
                  onClick={() => {
                    setView("pets");
                    setAccountMenuOpen(false);
                  }}
                >
                  我的宠物
                </button>
                <button
                  onClick={() => {
                    setView("professional");
                    setAccountMenuOpen(false);
                  }}
                >
                  专业身份认证
                </button>
                <div className="menu-divider" />
                <button className="logout-button" onClick={() => void logout()}>
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {view === "home" ? (
        <>
          <section className="welcome-section">
            <div>
              <p className="eyebrow">GOOD TO SEE YOU</p>
              <h1>你好，{session.user.nickname}</h1>
              <p>从宠物健康档案开始，建立属于你和它的长期健康轨迹。</p>
            </div>
            <button
              className="primary-button compact"
              onClick={() => {
                setView("pets");
                openCreatePet();
              }}
            >
              ＋ 添加宠物
            </button>
          </section>
          <section className="dashboard-grid">
            <article className="dashboard-card featured">
              <span className="card-icon">⌁</span>
              <div>
                <p className="eyebrow">HEALTH PROFILE</p>
                <h2>管理宠物健康档案</h2>
                <p>记录基础信息、疫苗、驱虫和每一次健康变化。</p>
              </div>
              <button className="link-button" onClick={() => setView("pets")}>
                查看我的宠物 →
              </button>
            </article>
            <article className="dashboard-card">
              <span className="card-icon cool">?</span>
              <div>
                <h3>健康问答</h3>
                <p>向认证宠物医生提出健康问题。</p>
              </div>
              <button className="link-button">查看问答 →</button>
            </article>
            <article className="dashboard-card">
              <span className="card-icon warm">♢</span>
              <div>
                <h3>专业身份认证</h3>
                <p>医生与医生助理可申请专业认证。</p>
              </div>
              <button
                className="link-button"
                onClick={() => setView("professional")}
              >
                了解认证 →
              </button>
            </article>
          </section>
        </>
      ) : view === "pets" ? (
        <section className="pets-page">
          <div className="page-heading">
            <div>
              <button
                className="back-button"
                onClick={() => {
                  setView("home");
                  setSelectedPet(null);
                }}
              >
                ← 返回首页
              </button>
              <p className="eyebrow">PET PROFILES</p>
              <h1>我的宠物</h1>
              <p>管理宠物资料，并按时间记录健康变化。</p>
            </div>
            <button className="primary-button compact" onClick={openCreatePet}>
              ＋ 新增宠物
            </button>
          </div>
          {petsLoading ? (
            <div className="empty-card">正在加载宠物档案…</div>
          ) : pets.length === 0 ? (
            <div className="empty-card">
              <span>⌁</span>
              <h2>还没有宠物档案</h2>
              <p>创建第一份档案，开始记录它的健康轨迹。</p>
              <button
                className="primary-button compact"
                onClick={openCreatePet}
              >
                创建宠物档案
              </button>
            </div>
          ) : (
            <div className="pet-layout">
              <div className="pet-list">
                {pets.map((pet) => (
                  <article
                    key={pet.id}
                    className={`pet-list-card ${selectedPet?.id === pet.id ? "selected" : ""}`}
                    onClick={() => void openPetDetail(pet)}
                  >
                    <div className="pet-symbol">
                      {pet.species === "CAT"
                        ? "猫"
                        : pet.species === "DOG"
                          ? "犬"
                          : "宠"}
                    </div>
                    <div>
                      <h3>{pet.name}</h3>
                      <p>
                        {pet.breed || pet.customSpecies || "品种未填写"} ·{" "}
                        {pet.ageText ||
                          (pet.birthDate
                            ? `${pet.birthDate.slice(0, 4)} 年出生`
                            : "年龄未知")}
                      </p>
                    </div>
                    <span>›</span>
                  </article>
                ))}
              </div>
              {selectedPet ? (
                <article className="pet-detail">
                  <div className="detail-head">
                    <div>
                      <p className="eyebrow">PET DETAIL</p>
                      <h2>{selectedPet.name}</h2>
                      <p>
                        {selectedPet.species === "CAT"
                          ? "猫"
                          : selectedPet.species === "DOG"
                            ? "狗"
                            : selectedPet.customSpecies}{" "}
                        · {selectedPet.breed || "未填写品种"}
                      </p>
                    </div>
                    <div className="detail-actions">
                      <button onClick={() => openEditPet(selectedPet)}>
                        编辑
                      </button>
                      <button
                        className="danger-text"
                        onClick={() => void removePet(selectedPet)}
                      >
                        停用
                      </button>
                    </div>
                  </div>
                  <dl className="pet-facts">
                    <div>
                      <dt>性别</dt>
                      <dd>
                        {selectedPet.gender === "MALE"
                          ? "公"
                          : selectedPet.gender === "FEMALE"
                            ? "母"
                            : "未知"}
                      </dd>
                    </div>
                    <div>
                      <dt>体重</dt>
                      <dd>
                        {selectedPet.weightKg
                          ? `${selectedPet.weightKg} kg`
                          : "未记录"}
                      </dd>
                    </div>
                    <div>
                      <dt>绝育</dt>
                      <dd>
                        {selectedPet.neutered == null
                          ? "未知"
                          : selectedPet.neutered
                            ? "是"
                            : "否"}
                      </dd>
                    </div>
                  </dl>
                  <div className="history-head">
                    <div>
                      <h3>病史时间线</h3>
                      <p>仅你本人可见，分享时需主动选择。</p>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => setHistoryFormOpen(true)}
                    >
                      ＋ 记录病史
                    </button>
                  </div>
                  {histories.length === 0 ? (
                    <div className="mini-empty">暂无病史记录</div>
                  ) : (
                    <div className="timeline">
                      {histories.map((item) => (
                        <div className="timeline-item" key={item.id}>
                          <time>{item.recordDate.slice(0, 10)}</time>
                          <div>
                            <h4>{item.title}</h4>
                            <p>{item.description}</p>
                            {(item.hospitalName || item.doctorName) && (
                              <small>
                                {[item.hospitalName, item.doctorName]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            )}
                            {item.treatment && (
                              <small>治疗：{item.treatment}</small>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ) : (
                <div className="pet-detail placeholder-detail">
                  选择一只宠物查看完整档案和病史
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
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
          {professionalState?.profile?.status === "APPROVED" ? (
            <div className="status-card approved">
              <span className="status-mark">✓</span>
              <div>
                <p className="eyebrow">VERIFIED</p>
                <h2>
                  {professionalState.profile.type === "VETERINARIAN"
                    ? "认证宠物医生"
                    : "认证医生助理"}
                </h2>
                <p>
                  {professionalState.profile.displayName}
                  ，你的专业身份已经生效。
                </p>
              </div>
            </div>
          ) : professionalState?.application?.status === "PENDING" ? (
            <div className="status-card pending">
              <span className="status-mark">⌛</span>
              <div>
                <p className="eyebrow">UNDER REVIEW</p>
                <h2>认证资料审核中</h2>
                <p>
                  申请身份：
                  {professionalState.application.requestedType ===
                  "VETERINARIAN"
                    ? "宠物医生"
                    : "医生助理"}{" "}
                  · {professionalState.application.organization}
                </p>
                <p className="status-note">
                  证明材料：
                  {professionalState.application.credentialMedia.originalName}
                </p>
                <button
                  className="danger-link"
                  onClick={() => void cancelProfessionalApplication()}
                >
                  撤销申请
                </button>
              </div>
            </div>
          ) : (
            <div className="professional-layout">
              <aside className="identity-choice">
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
              </aside>
              <form
                className="professional-form"
                onSubmit={submitProfessionalApplication}
              >
                <div>
                  <h2>填写认证资料</h2>
                  <p>真实姓名和证明材料仅用于审核，不会在公开主页展示。</p>
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
                  {busy ? "正在上传并提交…" : "提交认证申请"}
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {notificationCenterOpen && (
        <div className="modal-backdrop">
          <section className="notification-center-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">NOTIFICATIONS</p>
                <h2>消息中心</h2>
              </div>
              <button onClick={() => setNotificationCenterOpen(false)}>
                ×
              </button>
            </div>
            <div className="notification-filter-tabs">
              {(
                [
                  ["all", "全部"],
                  ["unread", "未读"],
                  ["professional", "身份认证"],
                  ["system", "系统消息"],
                ] as const
              ).map(([filter, label]) => (
                <button
                  key={filter}
                  className={notificationFilter === filter ? "active" : ""}
                  onClick={() => {
                    setNotificationFilter(filter);
                    void loadNotifications(filter);
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                className="read-all-action"
                onClick={() => void readAllNotifications()}
              >
                全部已读
              </button>
              <button className="read-all-action" onClick={() => void clearReadNotifications()}>清理已读</button>
            </div>
            <div className="notification-center-list user-notification-list">
              {notifications.length === 0 ? (
                <div className="inbox-empty">该分类暂时没有消息</div>
              ) : (
                notifications.map((item) => (
                  <button
                    key={item.id}
                    className={item.readAt ? "" : "unread"}
                    onClick={() => void readNotification(item)}
                  >
                    <span className="notification-center-icon">
                      {item.type.includes("PROFESSIONAL") ? "✓" : "i"}
                    </span>
                    <div>
                      <div>
                        <strong>{item.title}</strong>
                        {!item.readAt && <span>未读</span>}
                      </div>
                      <p>{item.content}</p>
                      <time>
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </time>
                    </div>
                    <span className="notification-row-actions"><span>→</span><span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); void deleteNotification(item.id); }}>删除</span></span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}
      {petFormOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setPetFormOpen(false)
          }
        >
          <form className="modal-card" onSubmit={savePet}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">PET PROFILE</p>
                <h2>{editingPetId ? "编辑宠物档案" : "新增宠物档案"}</h2>
              </div>
              <button type="button" onClick={() => setPetFormOpen(false)}>
                ×
              </button>
            </div>
            <div className="form-grid">
              <label>
                宠物昵称
                <input
                  required
                  maxLength={50}
                  value={petDraft.name}
                  onChange={(event) =>
                    setPetDraft({ ...petDraft, name: event.target.value })
                  }
                />
              </label>
              <label>
                宠物类型
                <select
                  value={petDraft.species}
                  onChange={(event) =>
                    setPetDraft({
                      ...petDraft,
                      species: event.target.value as Pet["species"],
                    })
                  }
                >
                  <option value="CAT">猫</option>
                  <option value="DOG">狗</option>
                  <option value="OTHER">其他</option>
                </select>
              </label>
              {petDraft.species === "OTHER" && (
                <label>
                  具体类型
                  <input
                    required
                    value={petDraft.customSpecies ?? ""}
                    onChange={(event) =>
                      setPetDraft({
                        ...petDraft,
                        customSpecies: event.target.value,
                      })
                    }
                  />
                </label>
              )}
              <label>
                品种
                <input
                  value={petDraft.breed ?? ""}
                  onChange={(event) =>
                    setPetDraft({ ...petDraft, breed: event.target.value })
                  }
                />
              </label>
              <label>
                性别
                <select
                  value={petDraft.gender}
                  onChange={(event) =>
                    setPetDraft({
                      ...petDraft,
                      gender: event.target.value as Pet["gender"],
                    })
                  }
                >
                  <option value="UNKNOWN">未知</option>
                  <option value="MALE">公</option>
                  <option value="FEMALE">母</option>
                </select>
              </label>
              <label>
                出生日期
                <input
                  type="date"
                  value={petDraft.birthDate ?? ""}
                  onChange={(event) =>
                    setPetDraft({
                      ...petDraft,
                      birthDate: event.target.value || null,
                    })
                  }
                />
              </label>
              <label>
                年龄描述
                <input
                  placeholder="日期不确定时填写，如约3岁"
                  value={petDraft.ageText ?? ""}
                  onChange={(event) =>
                    setPetDraft({ ...petDraft, ageText: event.target.value })
                  }
                />
              </label>
              <label>
                体重（kg）
                <input
                  type="number"
                  min="0.01"
                  max="9999"
                  step="0.01"
                  value={petDraft.weightKg ?? ""}
                  onChange={(event) =>
                    setPetDraft({
                      ...petDraft,
                      weightKg: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </label>
              <label>
                是否绝育
                <select
                  value={
                    petDraft.neutered == null ? "" : String(petDraft.neutered)
                  }
                  onChange={(event) =>
                    setPetDraft({
                      ...petDraft,
                      neutered:
                        event.target.value === ""
                          ? null
                          : event.target.value === "true",
                    })
                  }
                >
                  <option value="">未知</option>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </label>
              <label className="full">
                过敏史
                <textarea
                  value={petDraft.allergies ?? ""}
                  onChange={(event) =>
                    setPetDraft({ ...petDraft, allergies: event.target.value })
                  }
                />
              </label>
              <label className="full">
                既往疾病
                <textarea
                  value={petDraft.pastDiseases ?? ""}
                  onChange={(event) =>
                    setPetDraft({
                      ...petDraft,
                      pastDiseases: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPetFormOpen(false)}
              >
                取消
              </button>
              <button className="primary-button compact" disabled={busy}>
                {busy ? "保存中…" : "保存档案"}
              </button>
            </div>
          </form>
        </div>
      )}
      {historyFormOpen && selectedPet && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setHistoryFormOpen(false)
          }
        >
          <form className="modal-card small" onSubmit={saveHistory}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">MEDICAL HISTORY</p>
                <h2>记录 {selectedPet.name} 的病史</h2>
              </div>
              <button type="button" onClick={() => setHistoryFormOpen(false)}>
                ×
              </button>
            </div>
            <div className="form-grid">
              <label>
                记录日期
                <input
                  required
                  type="date"
                  value={historyDraft.recordDate}
                  onChange={(event) =>
                    setHistoryDraft({
                      ...historyDraft,
                      recordDate: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                疾病或症状名称
                <input
                  required
                  value={historyDraft.title}
                  onChange={(event) =>
                    setHistoryDraft({
                      ...historyDraft,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <label className="full">
                情况描述
                <textarea
                  required
                  rows={4}
                  value={historyDraft.description}
                  onChange={(event) =>
                    setHistoryDraft({
                      ...historyDraft,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                就诊医院
                <input
                  value={historyDraft.hospitalName}
                  onChange={(event) =>
                    setHistoryDraft({
                      ...historyDraft,
                      hospitalName: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                接诊医生
                <input
                  value={historyDraft.doctorName}
                  onChange={(event) =>
                    setHistoryDraft({
                      ...historyDraft,
                      doctorName: event.target.value,
                    })
                  }
                />
              </label>
              <label className="full">
                用药或治疗
                <textarea
                  value={historyDraft.treatment}
                  onChange={(event) =>
                    setHistoryDraft({
                      ...historyDraft,
                      treatment: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setHistoryFormOpen(false)}
              >
                取消
              </button>
              <button className="primary-button compact" disabled={busy}>
                {busy ? "保存中…" : "保存病史"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function AdminApp() {
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
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [professionalStatus, setProfessionalStatus] = useState<
    "APPROVED" | "REVOKED"
  >("APPROVED");
  const [professionals, setProfessionals] = useState<AdminProfessional[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<Notification[]>(
    [],
  );
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [adminInboxOpen, setAdminInboxOpen] = useState(false);

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

  useEffect(() => {
    if (!session) return;
    void loadAdminNotifications();
    const stream = new EventSource("/api/v1/admin/notifications/stream", {
      withCredentials: true,
    });
    stream.addEventListener("notification", (event) => {
      const notification = JSON.parse(
        (event as MessageEvent).data,
      ) as Notification;
      setAdminNotifications((items) => [
        notification,
        ...items.filter((item) => item.id !== notification.id),
      ]);
      setAdminUnreadCount((count) => count + 1);
      setMessage(notification.title);
      void loadDashboard();
    });
    return () => stream.close();
  }, [session?.admin.id]);

  async function loadAdminNotifications() {
    try {
      const result = await json<{
        data: { notifications: Notification[]; unreadCount: number };
      }>(
        await fetch("/api/v1/admin/notifications", { credentials: "include" }),
      );
      setAdminNotifications(result.data.notifications);
      setAdminUnreadCount(result.data.unreadCount);
    } catch {
      /* 通知失败不阻断后台 */
    }
  }

  async function readAdminNotification(item: Notification) {
    if (!session) return;
    if (!item.readAt) {
      const response = await fetch(
        `/api/v1/admin/notifications/${item.id}/read`,
        {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": session.csrfToken },
        },
      );
      if (response.ok) {
        setAdminNotifications((items) =>
          items.map((value) =>
            value.id === item.id
              ? { ...value, readAt: new Date().toISOString() }
              : value,
          ),
        );
        setAdminUnreadCount((count) => Math.max(0, count - 1));
      }
    }
    if (item.link?.includes("applications")) {
      setAdminPage("applications");
      setAdminInboxOpen(false);
    }
  }

  async function readAllAdminNotifications() {
    if (!session || adminUnreadCount === 0) return;
    const response = await fetch("/api/v1/admin/notifications/read-all", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": session.csrfToken },
    });
    if (response.ok) {
      const now = new Date().toISOString();
      setAdminNotifications((items) =>
        items.map((item) => ({ ...item, readAt: item.readAt ?? now })),
      );
      setAdminUnreadCount(0);
    }
  }

  async function deleteAdminNotification(id: number) {
    if (!session) return;
    const item = adminNotifications.find((value) => value.id === id);
    const response = await fetch(`/api/v1/admin/notifications/item/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": session.csrfToken },
    });
    if (response.ok) {
      setAdminNotifications((items) =>
        items.filter((value) => value.id !== id),
      );
      if (item && !item.readAt)
        setAdminUnreadCount((count) => Math.max(0, count - 1));
    }
  }

  async function clearReadAdminNotifications() {
    if (!session || !window.confirm("清理所有已读工作通知？未读通知会保留。"))
      return;
    const response = await fetch("/api/v1/admin/notifications/read", {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": session.csrfToken },
    });
    if (response.ok)
      setAdminNotifications((items) => items.filter((item) => !item.readAt));
  }

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
          ? "确认通过该认证申请？身份将立即生效。"
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
      <main className="admin-login-page">
        <form className="admin-login-card" onSubmit={login}>
          <a className="brand" href="/">
            <span className="brand-mark">P</span>Pawtrace
          </a>
          <div>
            <p className="eyebrow">ADMIN CONSOLE</p>
            <h1>认证审核管理端</h1>
            <p className="muted">使用独立管理员账户登录</p>
          </div>
          <label>
            管理员账号
            <input
              autoFocus
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            密码
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {message && <p className="form-message">{message}</p>}
          <button className="primary-button" disabled={busy}>
            {busy ? "正在登录…" : "登录管理端"}
          </button>
        </form>
      </main>
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
            <section className="admin-module">
              <div className="module-heading">
                <p className="eyebrow">NOTIFICATIONS</p>
                <h1>管理员通知中心</h1>
                <p>新的治理任务和系统提示会在这里持久保存并实时送达。</p>
              </div>
              <div className="notification-center-head">
                <strong>{adminUnreadCount} 条未读消息</strong>
                <div><button className="secondary-button" onClick={() => void readAllAdminNotifications()}>全部标为已读</button><button className="secondary-button" onClick={() => void clearReadAdminNotifications()}>清理已读</button></div>
              </div>
              <div className="notification-center-list">
                {adminNotifications.length === 0 ? (
                  <div className="empty-card">
                    <h2>暂时没有通知</h2>
                  </div>
                ) : (
                  adminNotifications.map((item) => (
                    <button
                      key={item.id}
                      className={item.readAt ? "" : "unread"}
                      onClick={() => void readAdminNotification(item)}
                    >
                      <span className="notification-center-icon">
                        {item.type.includes("APPLICATION") ? "✓" : "!"}
                      </span>
                      <div>
                        <div>
                          <strong>{item.title}</strong>
                          {!item.readAt && <span>未读</span>}
                        </div>
                        <p>{item.content}</p>
                        <time>
                          {new Date(item.createdAt).toLocaleString("zh-CN")}
                        </time>
                      </div>
                      <span className="notification-row-actions"><span>→</span><span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); void deleteAdminNotification(item.id); }}>删除</span></span>
                    </button>
                  ))
                )}
              </div>
            </section>
          )}
          {adminPage === "dashboard" && (
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
          )}
          {adminPage === "professionals" && (
            <section className="admin-module">
              <div className="module-heading">
                <p className="eyebrow">PROFESSIONALS</p>
                <h1>已认证人员</h1>
                <p>
                  管理已经生效或已撤销的专业身份。身份类型不能在此直接修改。
                </p>
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
                          {item.type === "VETERINARIAN"
                            ? "宠物医生"
                            : "医生助理"}{" "}
                          · {item.organization}
                        </p>
                        <small>
                          {item.user.phoneNumber} ·{" "}
                          {item.specialties.join("、")}
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
          )}
          {adminPage === "audit" && (
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
                    <time>
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </time>
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
          )}
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
                {(
                  ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const
                ).map((item) => (
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
                ))}
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
                            {selected.requestedType === "VETERINARIAN"
                              ? "宠物医生认证"
                              : "医生助理认证"}
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
                          <strong>认证证明材料</strong>
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
                                  className={
                                    reviewNote === reason ? "selected" : ""
                                  }
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
                              onChange={(event) =>
                                setReviewNote(event.target.value)
                              }
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
          )}
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return window.location.pathname.startsWith("/admin") ? (
    <AdminApp />
  ) : (
    <PublicApp />
  );
}
