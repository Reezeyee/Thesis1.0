import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { FarmManagement } from './components/FarmManagement';
import { EquipmentManagement } from './components/EquipmentManagement';
import { CherryManagement } from './components/CherryManagement';
import { ProfitManagement } from './components/ProfitManagement';
import { MaintenanceManagement } from './components/MaintenanceManagement';
import { WebsiteSettingsPanel } from './components/WebsiteSettingsPanel';
import { AuthProvider, useRequireAdmin } from './auth/AuthProvider';
import { LoginScreen } from './auth/LoginScreen';
import { FarmDataProvider, useFarmData } from './store/FarmDataProvider';

export type AppModuleId = 'dashboard' | 'farm' | 'equipment' | 'cherry' | 'profit' | 'maintenance' | 'settings';

function SaveStatusBanner() {
  const { saving, error } = useFarmData();
  if (!saving && !error) return null;
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        error
          ? 'border-red-300 bg-red-50 text-red-900'
          : 'border-[#2d5016]/30 bg-[#2d5016]/10 text-[#1b3310]'
      }`}
      role="status"
    >
      {saving ? 'Saving to Firebase…' : null}
      {error ? <span>{error}</span> : null}
    </div>
  );
}

function AdminAppShell() {
  const [activeModule, setActiveModule] = useState<AppModuleId>('dashboard');

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <Dashboard />;
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
      case 'settings':
        return <WebsiteSettingsPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Sidebar activeModule={activeModule} onModuleChange={(m) => setActiveModule(m as AppModuleId)} />
      <main className="ml-64 min-h-screen flex flex-col p-8 pb-12">
        <SaveStatusBanner />
        <div className="flex-1">{renderModule()}</div>
      </main>
    </div>
  );
}

function AuthenticatedApp() {
  const { session, loading, allowed } = useRequireAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-[#3e2723]">Administrator access only</h1>
          <p className="text-muted-foreground">
            This web portal is for farm administrators. Field staff should use the mobile app.
          </p>
          <p className="text-sm text-muted-foreground">Signed in as {session.email}</p>
        </div>
      </div>
    );
  }

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
