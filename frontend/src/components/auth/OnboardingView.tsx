import type { FormEvent } from "react";

type Props = {
  saveProfile: (event: FormEvent) => Promise<void>;
  nickname: string;
  setNickname: (value: string) => void;
  message: string;
  busy: boolean;
};

export default function OnboardingView({
  saveProfile,
  nickname,
  setNickname,
  message,
  busy,
}: Props) {
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
}
