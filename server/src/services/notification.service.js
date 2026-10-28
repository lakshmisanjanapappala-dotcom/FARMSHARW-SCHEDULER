import { memoryDb } from '../config/supabase.js';

export class NotificationService {
  static createNotification({ userId, title, message, type = 'system', linkUrl = null }) {
    const notification = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      user_id: userId,
      title,
      message,
      type,
      link_url: linkUrl,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString()
    };

    memoryDb.tables.notifications.unshift(notification);
    return notification;
  }

  static getUserNotifications(userId) {
    const notifications = memoryDb.tables.notifications.filter(n => n.user_id === userId);
    const unreadCount = notifications.filter(n => !n.is_read).length;
    return {
      notifications: notifications.slice(0, 50),
      unreadCount
    };
  }

  static markAsRead(notificationId, userId) {
    const notif = memoryDb.tables.notifications.find(n => n.id === notificationId && n.user_id === userId);
    if (notif) {
      notif.is_read = true;
      notif.read_at = new Date().toISOString();
    }
    return notif;
  }

  static markAllAsRead(userId) {
    const now = new Date().toISOString();
    memoryDb.tables.notifications
      .filter(n => n.user_id === userId && !n.is_read)
      .forEach(n => {
        n.is_read = true;
        n.read_at = now;
      });
    return { success: true };
  }
}

