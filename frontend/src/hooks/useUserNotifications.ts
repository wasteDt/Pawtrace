import { useEffect, useState } from "react";
import { type SessionData, type Notification, json } from "../shared";

export function useUserNotifications(
  session: SessionData | null,
  onOpenProfessional: () => void,
  onNewNotification: (title: string) => void,
) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [unreadCount, setUnreadCount] = useState(0);

  const [inboxOpen, setInboxOpen] = useState(false);

  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  const [notificationFilter, setNotificationFilter] = useState<
    "all" | "unread" | "professional" | "system"
  >("all");

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
      onNewNotification(notification.title);
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
      onOpenProfessional();
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

  return {
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
  };
}
