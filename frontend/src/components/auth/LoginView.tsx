import type { FormEvent } from "react";

type Props = {
  message: string;
  login: (event: FormEvent) => Promise<void>;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  busy: boolean;
  requestCode: () => Promise<void>;
  demoCode: string;
};

export default function LoginView({
  message,
  login,
  phoneNumber,
  setPhoneNumber,
  code,
  setCode,
  busy,
  requestCode,
  demoCode,
}: Props) {
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
}
