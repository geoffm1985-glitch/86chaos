import React from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  ChefHat,
  ChevronRight,
  HelpCircle,
  ClipboardCheck,
  Home,
  MessageSquare,
  MoreHorizontal,
  Package,
  Settings,
  Users,
} from 'lucide-react';
import { CheersLogo } from './common';

const ICONS = {
  today: Home,
  ops: ChefHat,
  prep: ClipboardCheck,
  inventory: Package,
  recipes: BookOpen,
  schedule: CalendarClock,
  team: Users,
  financials: BarChart3,
  messages: MessageSquare,
  godmode: Settings,
  settings: Settings,
  help: HelpCircle,
};

const NavIcon = ({ id, size = 18 }) => {
  const Icon = ICONS[id] || ChevronRight;
  return <Icon size={size} aria-hidden="true" />;
};

export const Concept17Sidebar = ({
  items = [],
  activeTab = 'today',
  onNavigate,
  clientData,
  restaurantName = '',
  userName = '',
  userRole = '',
  onOpenWorkspaceSwitcher,
  workspaceSwitchEnabled = false,
  menuLabel = 'Navigation',
  currentRestaurantLabel = 'Current Restaurant',
}) => (
  <aside className="concept17-sidebar" data-testid="concept17-desktop-sidebar" aria-label={menuLabel}>
    <div className="concept17-sidebar-brand">
      <CheersLogo clientData={clientData} />
    </div>

    <nav className="concept17-sidebar-nav">
      {items.map(item => {
        const selected = activeTab === item.id || (item.id === 'financials' && ['sales', 'labor', 'back-office'].includes(activeTab));
        return (
          <button
            key={item.id}
            type="button"
            className={`concept17-sidebar-item ${selected ? 'is-active' : ''}`}
            data-shell-route={item.id}
            aria-current={selected ? 'page' : undefined}
            onClick={() => onNavigate?.(item.id)}
          >
            <span className="concept17-sidebar-icon"><NavIcon id={item.id} /></span>
            <span className="concept17-sidebar-label">{item.label}</span>
            {item.alert && <span className="concept17-nav-alert" aria-label="New activity" />}
          </button>
        );
      })}
    </nav>

    <div className="concept17-sidebar-footer">
      <button
        type="button"
        className={`concept17-workspace-mini ${workspaceSwitchEnabled ? 'is-switchable' : ''}`}
        onClick={workspaceSwitchEnabled ? onOpenWorkspaceSwitcher : undefined}
        aria-label={workspaceSwitchEnabled ? `${currentRestaurantLabel}: ${restaurantName}.` : `${currentRestaurantLabel}: ${restaurantName}.`}
      >
        <span className="concept17-workspace-home"><Home size={15} aria-hidden="true" /></span>
        <span className="min-w-0">
          <strong>{restaurantName || currentRestaurantLabel}</strong>
          {workspaceSwitchEnabled && <small>{currentRestaurantLabel}</small>}
        </span>
        {workspaceSwitchEnabled && <ChevronRight size={14} aria-hidden="true" />}
      </button>
      <div className="concept17-user-mini">
        <span className="concept17-user-avatar" aria-hidden="true">
          {String(userName || '86').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '86'}
        </span>
        <span className="min-w-0">
          <strong>{userName || '86 Chaos'}</strong>
          <small>{userRole || 'Restaurant team'}</small>
        </span>
      </div>
    </div>
  </aside>
);

export const Concept17MobileNav = ({
  items = [],
  activeTab = 'today',
  onNavigate,
  onMore,
  moreLabel = 'More',
}) => (
  <nav className="concept17-mobile-nav" data-testid="concept17-mobile-bottom-nav" aria-label="Primary navigation">
    {items.slice(0, 4).map(item => {
      const selected = activeTab === item.id || (item.id === 'financials' && ['sales', 'labor', 'back-office'].includes(activeTab));
      return (
        <button
          key={item.id}
          type="button"
          className={`concept17-mobile-nav-item ${selected ? 'is-active' : ''}`}
          data-shell-route={item.id}
          aria-current={selected ? 'page' : undefined}
          onClick={() => onNavigate?.(item.id)}
        >
          <span className="concept17-mobile-nav-icon"><NavIcon id={item.id} size={19} /></span>
          <span>{item.mobileLabel || item.label}</span>
          {item.alert && <i className="concept17-nav-alert" aria-label="New activity" />}
        </button>
      );
    })}
    <button type="button" className="concept17-mobile-nav-item" onClick={onMore} aria-label={moreLabel}>
      <span className="concept17-mobile-nav-icon"><MoreHorizontal size={20} aria-hidden="true" /></span>
      <span>{moreLabel}</span>
    </button>
  </nav>
);
