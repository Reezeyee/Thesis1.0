import { LayoutDashboard, Users, Wrench, Coffee, DollarSign, Bell, Settings, Hammer, MessageSquare } from 'lucide-react';
import { cn } from './ui/utils';

interface SidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}

export function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Dashboard', hint: 'KPIs & overview' },
    { id: 'farm' as const, icon: Users, label: 'Farm Management', hint: 'HR & schedules' },
    { id: 'equipment' as const, icon: Wrench, label: 'Equipment Management', hint: 'Fleet & maintenance' },
    { id: 'cherry' as const, icon: Coffee, label: 'Coffee Cherry Management', hint: 'Batches from CNN scans' },
    { id: 'profit' as const, icon: DollarSign, label: 'Profit Module', hint: 'Income, expenses, buyers' },
    { id: 'maintenance' as const, icon: Hammer, label: 'Maintenance Module', hint: 'Logs, map & channels' },
    { id: 'sms' as const, icon: MessageSquare, label: 'SMS Module', hint: 'Worker communication' },
  ];

  const settingsActive = activeModule === 'settings';

  return (
    <div className="w-64 h-screen bg-[#4a2c2a] text-[#fdfbf7] flex flex-col fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2d5016] flex items-center justify-center">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-semibold">Acojido Farm</h1>
            <p className="text-xs text-[#d4a574] leading-tight">Web admin • not on mobile app</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onModuleChange(item.id)}
            className={`w-full flex flex-col items-stretch gap-0.5 text-left px-4 py-3 rounded-xl transition-all ${
              activeModule === item.id
                ? 'bg-[#2d5016] text-white shadow-lg'
                : 'text-[#d4a574] hover:bg-[#5d3a38] hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="font-medium">{item.label}</span>
            </span>
            <span
              className={`pl-8 text-[11px] leading-snug ${
                activeModule === item.id ? 'text-white/80' : 'text-[#c4a882]/90'
              }`}
            >
              {item.hint}
            </span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#d4a574] hover:bg-[#5d3a38] hover:text-white transition-all"
        >
          <Bell className="w-5 h-5" />
          <span>Notifications</span>
        </button>
        <button
          type="button"
          onClick={() => onModuleChange('settings')}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
            settingsActive ? 'bg-[#2d5016] text-white shadow-lg' : 'text-[#d4a574] hover:bg-[#5d3a38] hover:text-white'
          )}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
