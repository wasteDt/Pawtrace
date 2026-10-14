import type { FormEvent } from "react";

type Props = {
  busy: boolean;
  login: (event: FormEvent) => Promise<void>;
  message: string;
  password: string;
  setPassword: (value: string) => void;
  username: string;
  setUsername: (value: string) => void;
};

export default function AdminLoginView({
  busy,
  login,
  message,
  password,
  setPassword,
  username,
  setUsername,
}: Props) {
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
}
