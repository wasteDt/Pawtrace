import { useEffect, useState } from "react";
import { type AdminSession, type Notification, json } from "../shared";

export function useAdminNotifications(
  session: AdminSession | null,
  onOpenApplications: () => void,
  onNewNotification: (title: string) => void,
) {
  const [adminNotifications, setAdminNotifications] = useState<Notification[]>(
    [],
  );

  const [adminUnreadCount, setAdminUnreadCount] = useState(0);

  const [adminInboxOpen, setAdminInboxOpen] = useState(false);

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
      onNewNotification(notification.title);
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
      onOpenApplications();
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

  return {
    adminNotifications,
    adminUnreadCount,
    adminInboxOpen,
    readAdminNotification,
    readAllAdminNotifications,
    deleteAdminNotification,
    clearReadAdminNotifications,
    setAdminInboxOpen,
  };
}
