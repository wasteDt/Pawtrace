import { type Notification, type NotificationFilter } from "../../shared";

type Props = {
  notifications: Notification[];
  notificationFilter: NotificationFilter;
  setNotificationFilter: (filter: NotificationFilter) => void;
  loadNotifications: (filter?: NotificationFilter) => Promise<void>;
  readAllNotifications: () => Promise<void>;
  clearReadNotifications: () => Promise<void>;
  readNotification: (item: Notification) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  setNotificationCenterOpen: (open: boolean) => void;
};

export default function NotificationCenter({
  notifications,
  notificationFilter,
  setNotificationFilter,
  loadNotifications,
  readAllNotifications,
  clearReadNotifications,
  readNotification,
  deleteNotification,
  setNotificationCenterOpen,
}: Props) {
  return (
    <div className="modal-backdrop">
      <section className="notification-center-modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">NOTIFICATIONS</p>
            <h2>消息中心</h2>
          </div>
          <button onClick={() => setNotificationCenterOpen(false)}>×</button>
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
          <button
            className="read-all-action"
            onClick={() => void clearReadNotifications()}
          >
            清理已读
          </button>
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
                <span className="notification-row-actions">
                  <span>→</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteNotification(item.id);
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
    </div>
  );
}
