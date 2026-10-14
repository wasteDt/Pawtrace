import { type Notification } from "../../shared";

type Props = {
  adminUnreadCount: number;
  adminNotifications: Notification[];
  readAllAdminNotifications: () => Promise<void>;
  clearReadAdminNotifications: () => Promise<void>;
  readAdminNotification: (item: Notification) => Promise<void>;
  deleteAdminNotification: (id: number) => Promise<void>;
};

export default function AdminNotificationsView({
  adminUnreadCount,
  adminNotifications,
  readAllAdminNotifications,
  clearReadAdminNotifications,
  readAdminNotification,
  deleteAdminNotification,
}: Props) {
  return (
    <section className="admin-module">
      <div className="module-heading">
        <p className="eyebrow">NOTIFICATIONS</p>
        <h1>管理员通知中心</h1>
        <p>新的治理任务和系统提示会在这里持久保存并实时送达。</p>
      </div>
      <div className="notification-center-head">
        <strong>{adminUnreadCount} 条未读消息</strong>
        <div>
          <button
            className="secondary-button"
            onClick={() => void readAllAdminNotifications()}
          >
            全部标为已读
          </button>
          <button
            className="secondary-button"
            onClick={() => void clearReadAdminNotifications()}
          >
            清理已读
          </button>
        </div>
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
                <time>{new Date(item.createdAt).toLocaleString("zh-CN")}</time>
              </div>
              <span className="notification-row-actions">
                <span>→</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteAdminNotification(item.id);
                  }}
                >
                  删除
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
