import { type FormEvent, useEffect, useState } from "react";
import { useUserNotifications } from "../hooks/useUserNotifications";
import NotificationCenter from "../components/public/NotificationCenter";
import PetFormModal from "../components/public/PetFormModal";
import HistoryFormModal from "../components/public/HistoryFormModal";
import HomeView from "../components/public/HomeView";
import PetsView from "../components/public/PetsView";
import ProfessionalView from "../components/public/ProfessionalView";
import LoginView from "../components/auth/LoginView";
import OnboardingView from "../components/auth/OnboardingView";
import {
  type User,
  type SessionData,
  type ApiError,
  type Pet,
  type History,
  type PetDraft,
  type ProfessionalApplication,
  type ProfessionalState,
  type Notification,
  emptyPet,
  json,
} from "../shared";

export default function PublicApp() {
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
  const {
    notifications,
    unreadCount,
    inboxOpen,
    notificationCenterOpen,
    notificationFilter,
    loadNotifications,
    readNotification,
    readAllNotifications,
    deleteNotification,
    clearReadNotifications,
    setInboxOpen,
    setNotificationCenterOpen,
    setNotificationFilter,
  } = useUserNotifications(
    session,
    () => setView("professional"),
    (title) => {
      setMessage(title);
      void loadProfessionalState();
    },
  );

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
      setMessage(
        professionalState?.profile?.type === "ASSISTANT" &&
          professionalState.profile.status === "APPROVED"
          ? "升级申请已提交，审核期间医生助理身份继续有效"
          : "专业身份认证申请已提交",
      );
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
      !window.confirm(
        professionalState.application.purpose === "UPGRADE"
          ? "确定撤回升级申请吗？当前医生助理身份不会受影响。"
          : "确定撤销当前认证申请吗？",
      )
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
      setMessage(
        professionalState.application.purpose === "UPGRADE"
          ? "升级申请已撤回，医生助理身份仍有效"
          : "认证申请已撤销",
      );
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
      <LoginView
        message={message}
        login={login}
        phoneNumber={phoneNumber}
        setPhoneNumber={setPhoneNumber}
        code={code}
        setCode={setCode}
        busy={busy}
        requestCode={requestCode}
        demoCode={demoCode}
      />
    );

  if (!session.user.profileCompleted)
    return (
      <OnboardingView
        saveProfile={saveProfile}
        nickname={nickname}
        setNickname={setNickname}
        message={message}
        busy={busy}
      />
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
        <HomeView
          session={session}
          setView={setView}
          openCreatePet={openCreatePet}
        />
      ) : view === "pets" ? (
        <PetsView
          pets={pets}
          petsLoading={petsLoading}
          histories={histories}
          selectedPet={selectedPet}
          openCreatePet={openCreatePet}
          openPetDetail={openPetDetail}
          openEditPet={openEditPet}
          removePet={removePet}
          setSelectedPet={setSelectedPet}
          setHistoryFormOpen={setHistoryFormOpen}
          setView={setView}
        />
      ) : (
        <ProfessionalView
          professionalState={professionalState}
          professionalDraft={professionalDraft}
          setProfessionalDraft={setProfessionalDraft}
          setCredentialFile={setCredentialFile}
          setView={setView}
          busy={busy}
          cancelProfessionalApplication={cancelProfessionalApplication}
          submitProfessionalApplication={submitProfessionalApplication}
        />
      )}

      {notificationCenterOpen && (
        <NotificationCenter
          notifications={notifications}
          notificationFilter={notificationFilter}
          setNotificationFilter={setNotificationFilter}
          loadNotifications={loadNotifications}
          readAllNotifications={readAllNotifications}
          clearReadNotifications={clearReadNotifications}
          readNotification={readNotification}
          deleteNotification={deleteNotification}
          setNotificationCenterOpen={setNotificationCenterOpen}
        />
      )}
      {petFormOpen && (
        <PetFormModal
          petDraft={petDraft}
          setPetDraft={setPetDraft}
          editingPetId={editingPetId}
          busy={busy}
          savePet={savePet}
          setPetFormOpen={setPetFormOpen}
        />
      )}
      {historyFormOpen && selectedPet && (
        <HistoryFormModal
          historyDraft={historyDraft}
          setHistoryDraft={setHistoryDraft}
          selectedPet={selectedPet}
          busy={busy}
          saveHistory={saveHistory}
          setHistoryFormOpen={setHistoryFormOpen}
        />
      )}
    </main>
  );
}
