import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  RefreshCw,
  X,
  ShoppingCart,
  ShieldCheck,
  PackageSearch,
  Truck,
  Droplet,
  Scissors,
  Layers,
  FileText,
  Clock,
  Sparkles,
  Inbox,
  AlertTriangle
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

// Helper to format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSecs = Math.floor((now - past) / 1000);

  if (diffInSecs < 60) return 'Just now';
  const diffInMins = Math.floor(diffInSecs / 60);
  if (diffInMins < 60) return `${diffInMins}m ago`;
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    categoryTabs,
    loading,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    isRead
  } = useNotifications();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter notifications based on selected tab and unread filter
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Tab filter
      const matchesTab = selectedTab === 'all' || item.category === selectedTab;
      // Read/Unread filter
      const matchesUnread = !filterUnreadOnly || !isRead(item.id);
      return matchesTab && matchesUnread;
    });
  }, [notifications, selectedTab, filterUnreadOnly, isRead]);

  // Count unread per tab
  const getTabUnreadCount = (tabId) => {
    if (tabId === 'all') return unreadCount;
    return notifications.filter((n) => n.category === tabId && !isRead(n.id)).length;
  };

  // Get icon for notification type
  const getNotificationIcon = (item) => {
    const iconSize = 16;
    switch (item.type) {
      case 'order':
        return <ShoppingCart size={iconSize} className="text-blue-500" />;
      case 'approval':
        return <ShieldCheck size={iconSize} className="text-amber-500" />;
      case 'greige_receipt':
      case 'dyed_receipt':
        return <PackageSearch size={iconSize} className="text-emerald-500" />;
      case 'greige_delivery':
      case 'dyed_delivery':
        return <Truck size={iconSize} className="text-blue-600" />;
      case 'dispatch':
        return <Truck size={iconSize} className="text-purple-500" />;
      case 'dof':
        return <Droplet size={iconSize} className="text-cyan-500" />;
      case 'wof':
      case 'sof':
      case 'wvof':
        return <Layers size={iconSize} className="text-indigo-500" />;
      case 'pof':
        return <Scissors size={iconSize} className="text-rose-500" />;
      case 'bill':
      case 'invoice':
        return <FileText size={iconSize} className="text-teal-500" />;
      default:
        return <Sparkles size={iconSize} className="text-gray-500" />;
    }
  };

  const handleNotificationClick = (item) => {
    markAsRead(item.id);
    setIsOpen(false);
    if (item.route) {
      navigate(item.route);
    }
  };

  return (
    <div className="notification-bell-wrapper" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        title="Notifications"
      >
        <Bell size={20} className={unreadCount > 0 ? 'bell-shake' : ''} />
        {unreadCount > 0 && (
          <span className="notification-badge-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="notification-dropdown-panel fade-in">
          {/* Header */}
          <div className="notification-header">
            <div className="notification-header-left">
              <span className="notification-title">Notifications</span>
              {unreadCount > 0 && (
                <span className="notification-unread-pill">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="notification-header-actions">
              <button
                type="button"
                className="notification-icon-action-btn"
                onClick={() => refreshNotifications()}
                title="Refresh notifications"
              >
                <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-text-action-btn"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                className="notification-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="notification-tabs-bar">
            {categoryTabs.map((tab) => {
              const tabUnread = getTabUnreadCount(tab.id);
              const isActive = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`notification-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  {tabUnread > 0 && (
                    <span className="tab-unread-dot-badge">{tabUnread}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-filter bar: Unread toggle & stats */}
          <div className="notification-sub-bar">
            <span className="notification-count-text">
              Showing {filteredNotifications.length} of {notifications.length} updates
            </span>
            <label className="notification-unread-toggle">
              <input
                type="checkbox"
                checked={filterUnreadOnly}
                onChange={(e) => setFilterUnreadOnly(e.target.checked)}
              />
              <span>Unread only</span>
            </label>
          </div>

          {/* Notifications List Body */}
          <div className="notification-list-container custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="notification-empty-state">
                <RefreshCw size={24} className="spin-anim text-muted" />
                <p>Loading latest updates...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="notification-empty-state">
                <Inbox size={36} className="empty-icon" />
                <p className="empty-title">No notifications</p>
                <p className="empty-subtitle">
                  {filterUnreadOnly
                    ? 'You have caught up with all updates in this category.'
                    : 'No recent activities found for this section.'}
                </p>
              </div>
            ) : (
              <div className="notification-items-wrapper">
                {filteredNotifications.map((item) => {
                  const read = isRead(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`notification-item-card ${read ? 'read' : 'unread'} ${item.priority === 'urgent' ? 'urgent' : ''}`}
                      onClick={() => handleNotificationClick(item)}
                    >
                      <div className="notification-item-icon-col">
                        <div className={`notification-icon-bubble type-${item.type}`}>
                          {getNotificationIcon(item)}
                        </div>
                      </div>

                      <div className="notification-item-content">
                        <div className="notification-item-header">
                          <span className="notification-item-title">
                            {item.title}
                          </span>
                          <span className="notification-item-time">
                            <Clock size={11} />
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>

                        <p className="notification-item-desc">
                          {item.description}
                        </p>

                        <div className="notification-item-footer">
                          {item.status && (
                            <span className={`notification-status-chip status-${item.status}`}>
                              {item.status.replace('_', ' ')}
                            </span>
                          )}
                          {!read && (
                            <span
                              className="mark-single-read-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(item.id);
                              }}
                              title="Mark as read"
                            >
                              <Check size={12} /> Mark read
                            </span>
                          )}
                        </div>
                      </div>

                      {!read && <span className="notification-unread-dot" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="notification-dropdown-footer">
            <span className="footer-auto-refresh-text">
              ● Live updates enabled
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="footer-clear-btn"
                onClick={markAllAsRead}
              >
                Clear all badges
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
