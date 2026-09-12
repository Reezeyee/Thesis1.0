import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/ui/Topbar';
import { FarmMonitoringDashboard } from './components/FarmMonitoringDashboard';
import { PremiumDashboard } from './components/PremiumDashboard';
import { FarmManagement } from './components/FarmManagement';
import { EquipmentManagement } from './components/EquipmentManagement';
import { CherryManagement } from './components/CherryManagement';
import { ProfitManagement } from './components/ProfitManagement';
import { MaintenanceManagement } from './components/MaintenanceManagement';
import { WebsiteSettingsPanel } from './components/WebsiteSettingsPanel';
import { SmsManagement } from './components/SmsManagement';
import { CommandSearchModal } from './components/CommandSearchModal';
import { AuthProvider, useRequireAdmin, useAuth } from './auth/AuthProvider';
import { LoginScreen } from './auth/LoginScreen';
import { FarmDataProvider, useFarmData } from './store/FarmDataProvider';
import { GlobalNotificationBanner, NotificationDrawer, PasswordResetMessageSync, usePendingReports } from './components/NotificationCenter';

export type AppModuleId = 'monitoring' | 'dashboard' | 'farm' | 'equipment' | 'cherry' | 'profit' | 'maintenance' | 'sms' | 'settings';


const moduleLabels: Record<AppModuleId, string> = {
  monitoring: 'Telemetry & Sensor Monitor',
  dashboard: 'Dashboard Overview',
  farm: 'Farm HR & Workers',
  equipment: 'Equipment Management',
  cherry: 'Coffee Cherry Batches',
  profit: 'Profit & Sales Ledger',
  maintenance: 'Maintenance & Maps',
  sms: 'SMS Center',
  settings: 'Website Settings',
};

function SaveStatusBanner() {
  const { saving, error } = useFarmData();
  if (!saving && !error) return null;
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-xs font-medium ${
        error
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      }`}
      role="status"
    >
      {saving ? 'Saving updates to Cloud Database…' : null}
      {error ? <span>{error}</span> : null}
    </div>
  );
}

function AdminAppShell() {
  const [activeModule, setActiveModule] = useState<AppModuleId>('monitoring');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(true); // Default to dark mode for Database Monitoring visual impact
  const { session, signOut } = useAuth();

  const pendingReports = usePendingReports();

  useEffect(() => {
    // Ensure dark mode class is applied by default for monitoring console
    document.documentElement.classList.add('dark');
  }, []);

  const handleToggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const handleNavigateModule = (module: AppModuleId, targetElementId?: string) => {
    setActiveModule(module);
    if (targetElementId) {
      setTimeout(() => {
        const elem = document.getElementById(targetElementId);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          elem.classList.add('ring-4', 'ring-accent/50', 'transition-all', 'duration-300');
          setTimeout(() => {
            elem.classList.remove('ring-4', 'ring-accent/50');
          }, 3000);
        }
      }, 150);
    }
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'monitoring':
        return <FarmMonitoringDashboard />;
      case 'dashboard':
        return <PremiumDashboard onNavigateModule={handleNavigateModule} />;
      case 'farm':
        return <FarmManagement />;
      case 'equipment':
        return <EquipmentManagement />;
      case 'cherry':
        return <CherryManagement />;
      case 'profit':
        return <ProfitManagement />;
      case 'maintenance':
        return <MaintenanceManagement />;
      case 'sms':
        return <SmsManagement />;
      case 'settings':
        return <WebsiteSettingsPanel />;
      default:
        return <FarmMonitoringDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        activeModule={activeModule}
        onModuleChange={(m) => setActiveModule(m as AppModuleId)}
        pendingCount={pendingReports.length}
        onOpenNotifications={() => setDrawerOpen(true)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <PasswordResetMessageSync />
      <GlobalNotificationBanner onNavigateModule={handleNavigateModule} />
      <NotificationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigateModule={handleNavigateModule}
      />
      <CommandSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigateModule={handleNavigateModule}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Topbar
          breadcrumbs={[
            { label: 'Acojido Farm' },
            { label: moduleLabels[activeModule] || 'Overview' },
          ]}
          onOpenSearch={() => setSearchOpen(true)}
          notificationsCount={pendingReports.length}
          onOpenNotifications={() => setDrawerOpen(true)}
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          user={{
            name: session?.displayName || session?.email?.split('@')[0] || 'Farm Administrator',
            email: session?.email || 'admin@acojidofarm.ph',
            role: 'Farm Administrator',
          }}
          onSignOut={signOut}
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <SaveStatusBanner />
          {renderModule()}
        </main>
      </div>
    </div>
  );
}

import { ShieldAlert } from 'lucide-react';
import { Button } from './components/ui/button';

function AuthenticatedApp() {
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Initializing Coffee Farm Admin Portal…</p>
        </div>
      </div>
    );
  }

  // 1. Admin Login Screen
  if (!session) {
    return <LoginScreen />;
  }

  // 2. If a field worker account logs in on the website, restrict access
  if (session.role === 'FARM_STAFF') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold font-heading text-foreground">Admin Portal Access Only</h2>
          <p className="text-xs text-muted-foreground">
            This website is reserved for Farm Administrators only. Field workers must access the Coffee Farm Scanner & Operations tool through the Android mobile app.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              onClick={signOut}
              className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs cursor-pointer"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Administrators receive the Admin App Shell
  return (
    <FarmDataProvider>
      <AdminAppShell />
    </FarmDataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

