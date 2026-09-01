import React, { useState } from 'react';
import {
  Activity,
  LayoutDashboard,
  Users,
  Wrench,
  Coffee,
  DollarSign,
  Bell,
  Settings,
  Hammer,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Sprout,
  ShieldAlert,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from './ui/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export interface SidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  pendingCount?: number;
  onOpenNotifications?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  activeModule,
  onModuleChange,
  pendingCount = 0,
  onOpenNotifications,
  isCollapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const navGroups = [
    {
      groupLabel: 'Main',
      items: [
        {
          id: 'monitoring',
          icon: Activity,
          label: 'Telemetry Monitor',
          badge: 'LIVE',
          hint: 'Database & sensor node health',
        },
        {
          id: 'dashboard',
          icon: LayoutDashboard,
          label: 'Dashboard Overview',
          badge: null,
          hint: 'KPIs & finances',
        },
      ],
    },
    {
      groupLabel: 'Management',
      items: [
        {
          id: 'farm',
          icon: Users,
          label: 'Farm HR',
          badge: null,
          hint: 'Workers & schedules',
        },
        {
          id: 'equipment',
          icon: Wrench,
          label: 'Equipment',
          badge: null,
          hint: 'Fleet & assets',
        },
        {
          id: 'cherry',
          icon: Coffee,
          label: 'Coffee Cherries',
          badge: 'CNN',
          hint: 'Batches & scans',
        },
        {
          id: 'profit',
          icon: DollarSign,
          label: 'Profit & Sales',
          badge: null,
          hint: 'Finances & buyers',
        },
        {
          id: 'maintenance',
          icon: Hammer,
          label: 'Maintenance',
          badge: null,
          hint: 'Field logs & map',
        },
      ],
    },
    {
      groupLabel: 'Communication',
      items: [
        {
          id: 'sms',
          icon: MessageSquare,
          label: 'SMS Center',
          badge: null,
          hint: 'Worker broadcasts',
        },
      ],
    },
  ];

  const sidebarContent = (
    <aside
      className={cn(
        'h-full bg-card border-r border-border/60 flex flex-col justify-between transition-all duration-300 select-none relative',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Sidebar Header / Brand Switcher */}
      <div className="p-4 border-b border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Sprout className="w-5 h-5 stroke-[2]" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm font-heading tracking-tight text-foreground truncate">
                Acojido Farm
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                Agricultural Admin Portal
              </span>
            </div>
          )}
        </div>

        {/* Desktop Collapse Button */}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="hidden lg:flex h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        )}

        {/* Mobile Close Button */}
        {mobileOpen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="lg:hidden h-8 w-8 rounded-lg text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {navGroups.map((group, idx) => (
          <div key={group.groupLabel || idx} className="space-y-1">
            {!isCollapsed && (
              <h2 className="px-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
                {group.groupLabel}
              </h2>
            )}
            {group.items.map((item) => {
              const isActive = activeModule === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onModuleChange(item.id);
                    if (onMobileClose) onMobileClose();
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 relative group',
                    isActive
                      ? 'bg-accent/15 text-accent-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {/* Left Active Line Indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent rounded-r-full" />
                  )}

                  <div
                    className={cn(
                      'p-1.5 rounded-md shrink-0 transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-secondary/60 text-muted-foreground group-hover:text-foreground group-hover:bg-secondary'
                    )}
                  >
                    <Icon className="w-4 h-4 stroke-[1.75]" />
                  </div>

                  {!isCollapsed && (
                    <div className="flex flex-col text-left flex-1 truncate">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] font-semibold font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer (Notifications & Settings) */}
      <div className="p-3 border-t border-border/60 space-y-1 bg-muted/20">
        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
              isCollapsed && 'justify-center'
            )}
            title={isCollapsed ? 'Notifications' : undefined}
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-secondary/60 text-muted-foreground relative">
                <Bell className="w-4 h-4 stroke-[1.75]" />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-card" />
                )}
              </div>
              {!isCollapsed && <span>Alert Center</span>}
            </div>
            {!isCollapsed && pendingCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold">
                {pendingCount}
              </Badge>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onModuleChange('settings');
            if (onMobileClose) onMobileClose();
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
            activeModule === 'settings'
              ? 'bg-accent/15 text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            isCollapsed && 'justify-center'
          )}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <div
            className={cn(
              'p-1.5 rounded-md transition-colors',
              activeModule === 'settings'
                ? 'bg-accent text-accent-foreground'
                : 'bg-secondary/60 text-muted-foreground'
            )}
          >
            <Settings className="w-4 h-4 stroke-[1.75]" />
          </div>
          {!isCollapsed && <span>Settings & Config</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-40 h-screen">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Backdrop & Sheet */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
