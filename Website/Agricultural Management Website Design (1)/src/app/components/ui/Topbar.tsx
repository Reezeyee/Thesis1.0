import React from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronRight,
  Menu,
  User,
  Settings,
  LogOut,
  SlidersHorizontal,
  Command,
} from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

export interface TopbarProps {
  breadcrumbs?: Array<{ label: string; href?: string }>;
  onOpenSearch?: () => void;
  notificationsCount?: number;
  onOpenNotifications?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
  };
  onSignOut?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  breadcrumbs = [{ label: 'Overview' }, { label: 'Dashboard' }],
  onOpenSearch,
  notificationsCount = 0,
  onOpenNotifications,
  darkMode = false,
  onToggleDarkMode,
  user = { name: 'Farm Admin', email: 'admin@acojidofarm.ph', role: 'Administrator' },
  onSignOut,
  onToggleMobileSidebar,
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 w-full border-b border-border/60 bg-background/80 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between gap-4 transition-colors">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        {onToggleMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMobileSidebar}
            className="lg:hidden text-muted-foreground hover:text-foreground -ml-2"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}

        <nav className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label + idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />}
              <span
                className={
                  idx === breadcrumbs.length - 1
                    ? 'text-foreground font-semibold font-heading'
                    : 'text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
                }
              >
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: Search, Actions, Theme Toggle, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search Command Input Bar */}
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/80 bg-muted/50 hover:bg-muted text-muted-foreground text-xs font-normal transition-all hover:border-border min-w-[200px] lg:min-w-[260px] justify-between group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 stroke-[2] group-hover:text-foreground transition-colors" />
            <span>Search modules, crops, batch...</span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground bg-background border border-border rounded shadow-2xs">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSearch}
          className="sm:hidden text-muted-foreground hover:text-foreground rounded-lg"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Dark Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          className="text-muted-foreground hover:text-foreground rounded-lg transition-transform active:scale-95"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? (
            <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </Button>

        {/* Notifications Drawer Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenNotifications}
          className="relative text-muted-foreground hover:text-foreground rounded-lg"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {notificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
          )}
        </Button>

        <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 p-1.5 hover:bg-muted/80 rounded-lg text-left"
            >
              <Avatar className="h-7 w-7 border border-border">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col text-left leading-none">
                <span className="text-xs font-semibold text-foreground font-heading">
                  {user.name}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {user.role}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold font-heading leading-none">{user.name}</p>
                <p className="text-[11px] leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-xs cursor-pointer">
                <User className="w-3.5 h-3.5 mr-2" /> Profile Account
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer">
                <Settings className="w-3.5 h-3.5 mr-2" /> Admin Preferences
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-2" /> System Configuration
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSignOut}
              className="text-xs text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
