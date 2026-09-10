import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Search,
  LayoutDashboard,
  Users,
  Wrench,
  Coffee,
  DollarSign,
  Hammer,
  MessageSquare,
  Settings,
  Sparkles,
  MapPin,
  Package,
  FileText,
} from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from './ui/command';
import { useFarmData } from '../store/FarmDataProvider';
import { formatCurrency } from '../lib/currencyFormat';
import { computeLowStockThreshold } from '../types/appState';
import { isWorkerActive } from '../lib/workerUi';
import { AppModuleId } from '../App';

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateModule: (module: AppModuleId, targetElementId?: string) => void;
}

export const CommandSearchModal: React.FC<CommandSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateModule,
}) => {
  const { state } = useFarmData();
  const [activeCategory, setActiveCategory] = useState<'all' | 'modules' | 'workers' | 'inventory' | 'sales'>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (module: AppModuleId, targetElementId?: string) => {
    onNavigateModule(module, targetElementId);
    onClose();
  };

  const activeWorkersCount = useMemo(() => state.workers.filter(isWorkerActive).length, [state.workers]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-card border-border/80 shadow-2xl rounded-2xl">
        <Command className="border-none bg-transparent">
          <div className="flex items-center px-3.5 border-b border-border/60">
            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
            <CommandInput
              placeholder="Search workers, inventory, sales, reports, or modules..."
              className="h-12 border-none focus:ring-0 text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-1 p-2 border-b border-border/40 text-xs overflow-x-auto bg-muted/20">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeCategory === 'all' ? 'bg-[#2d5016] text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('workers')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeCategory === 'workers' ? 'bg-[#2d5016] text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Workers ({activeWorkersCount} Active / {state.workers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('inventory')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeCategory === 'inventory' ? 'bg-[#2d5016] text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Supplies & Fleet ({state.consumableSupplies.length + state.equipment.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('sales')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeCategory === 'sales' ? 'bg-[#2d5016] text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Sales & Buyers ({state.sales.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('modules')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeCategory === 'modules' ? 'bg-[#2d5016] text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Modules
            </button>
          </div>

          <CommandList className="max-h-[380px] p-2 overflow-y-auto">
            <CommandEmpty className="py-8 text-center text-xs text-muted-foreground font-mono">
              No matching records or modules found.
            </CommandEmpty>

            {(activeCategory === 'all' || activeCategory === 'workers') && state.workers.length > 0 && (
              <CommandGroup heading="Registered Personnel & Workers">
                {state.workers.slice(0, 10).map((w, idx) => {
                  const active = isWorkerActive(w);
                  return (
                    <CommandItem
                      key={w.workerId || idx}
                      value={`${w.name} ${w.roleRate} ${w.address || ''}`}
                      onSelect={() => handleSelect('farm')}
                      className="flex items-center justify-between gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                        }`}>
                          {w.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="truncate flex items-center gap-2">
                          <span className="font-semibold text-foreground">{w.name}</span>
                          <span className="text-muted-foreground">({w.roleRate})</span>
                          <span className={`text-[9px] font-mono px-1 rounded ${
                            active ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                          }`}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        ID: {w.workerId || `EMP-${idx}`}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {(activeCategory === 'all' || activeCategory === 'inventory') && state.consumableSupplies.length > 0 && (
              <CommandGroup heading="Consumable Supplies & Materials">
                {state.consumableSupplies.slice(0, 8).map((s) => {
                  const threshold = computeLowStockThreshold(s);
                  const isLow = s.stock <= threshold;
                  return (
                    <CommandItem
                      key={s.supplyId}
                      value={`${s.name} ${s.category} ${s.supplyId}`}
                      onSelect={() => handleSelect('equipment')}
                      className="flex items-center justify-between gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Package className={`w-4 h-4 shrink-0 ${isLow ? 'text-amber-500' : 'text-foreground'}`} />
                        <div className="truncate">
                          <span className="font-semibold text-foreground">{s.name}</span>
                          <span className="text-muted-foreground ml-2">[{s.category}]</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {s.stock} {s.unit}
                        </span>
                        {isLow && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">
                            Low
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {(activeCategory === 'all' || activeCategory === 'sales') && state.sales.length > 0 && (
              <CommandGroup heading="Recent Coffee Sales & Buyers">
                {state.sales.slice(0, 6).map((s, idx) => (
                  <CommandItem
                    key={s.saleId || idx}
                    value={`${s.buyer} ${s.details || ''} ${s.date || ''}`}
                    onSelect={() => handleSelect('profit')}
                    className="flex items-center justify-between gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-foreground">{s.buyer}</span>
                        <span className="text-muted-foreground ml-2">· {s.details}</span>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-600 shrink-0">
                      {formatCurrency(s.total)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(activeCategory === 'all' || activeCategory === 'modules') && (
              <CommandGroup heading="System Navigation Modules">
                <CommandItem
                  onSelect={() => handleSelect('monitoring')}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                >
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-foreground font-heading">Telemetry & Sensor Monitor</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">⌘1</span>
                </CommandItem>

                <CommandItem
                  onSelect={() => handleSelect('dashboard')}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4 text-accent" />
                  <span className="font-semibold text-foreground font-heading">Dashboard Analytics</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">⌘2</span>
                </CommandItem>

                <CommandItem
                  onSelect={() => handleSelect('farm')}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                >
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-foreground font-heading">Farm HR & Worker Management</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">⌘3</span>
                </CommandItem>

                <CommandItem
                  onSelect={() => handleSelect('equipment')}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                >
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-foreground font-heading">Equipment & Inventory Supplies</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">⌘4</span>
                </CommandItem>

                <CommandItem
                  onSelect={() => handleSelect('cherry')}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                >
                  <Coffee className="w-4 h-4 text-purple-500" />
                  <span className="font-semibold text-foreground font-heading">Coffee Cherry CNN Scanner & Batches</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">⌘5</span>
                </CommandItem>

                <CommandItem
                  onSelect={() => handleSelect('profit')}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-foreground font-heading">Profit & Sales Ledger</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">⌘6</span>
                </CommandItem>

                <CommandItem
                  onSelect={() => handleSelect('maintenance')}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                >
                  <Hammer className="w-4 h-4 text-rose-500" />
                  <span className="font-semibold text-foreground font-heading">Field Maintenance Logs & Map</span>
                </CommandItem>

                <CommandItem
                  onSelect={() => handleSelect('sms')}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-foreground font-heading">SMS Broadcast Center</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
