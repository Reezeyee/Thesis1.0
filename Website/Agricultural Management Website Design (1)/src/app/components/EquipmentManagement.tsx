import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SelectWithOther } from './ui/SelectWithOther';
import { Wrench, CheckCircle, AlertTriangle, Calendar, Edit2, Plus, X, Search, Sparkles, MinusCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35 },
  },
};
import {
  CHART_COLORS,
  CHART_EQUIPMENT_STATUS,
  CHART_MARGIN_WITH_BOTTOM_LABELS,
  chartMonetarySeriesHasData,
  chartPieHasData,
  pesoFormatter,
  truncateLabel,
} from '../lib/chartTheme';
import { formatCurrency } from '../lib/currencyFormat';
import {
  buildEquipmentStatusSlices,
  buildMaintenanceMonthlyChart,
  buildUsageByEquipmentChart,
  effectiveEquipmentStatus,
  mapEquipStatus,
  maintenanceChartHasData,
  latestMaintenanceLabel,
  pendingMaintenanceIssueCount,
  sumUsageHoursForEquipment,
} from '../lib/equipmentChartData';
import {
  equipmentReportBadgeClass,
  equipmentReportConditionLabel,
  isEquipmentFixedReport,
} from '../lib/equipmentReportLabels';
import {
  ChartLegendList,
  ChartPanel,
  ColoredDonutChart,
  countTooltipFormatter,
  farmAxisTick,
  farmChartBottomMargin,
  farmMonthXAxisProps,
  farmTooltipProps,
} from './charts/FarmCharts';
import { useFarmData } from '../store/FarmDataProvider';
import { runSave, showSaveError } from '../lib/saveFeedback';
import { parseWorkerDetails, isWorkerActive } from '../lib/workerUi';
import {
  computeLowStockThreshold,
  computeSupplyStatus,
  type ConsumableSupplyReportRecord,
  type ConsumableSupplyRecord,
  type EquipmentConditionReport,
  type EquipmentRecord,
  type MaintenanceRecord,
  type WorkerRecord,
} from '../types/appState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Equipment {
  id: number;
  name: string;
  type: string;
  status: ReturnType<typeof effectiveEquipmentStatus>;
  inventoryStatus: string;
  lastMaintenance: string;
  usageHours: number;
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-border/80 bg-background/80 px-3 py-1 text-sm';

const SCROLL_PANEL_CLASS = 'overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#4a2c2a]/25';

const EQUIPMENT_CATEGORIES = [
  'Processing',
  'Spraying',
  'Cutting',
  'Drying',
  'Harvest',
  'Quality',
  'Transport',
  'Power',
] as const;

const SUPPLY_CATEGORIES = ['Fertilizer', 'Pesticides', 'Vitamins', 'Packaging', 'Cleaning', 'Other'] as const;

type SupplyForm = {
  name: string;
  category: string;
  stock: string;
  unit: string;
  referenceStock: string;
  lowStockThreshold: string;
};

function emptyEquipmentRecord(): EquipmentRecord {
  return {
    name: '',
    category: 'Harvest',
    status: 'available',
    assignedTo: null,
    currentValue: 0,
  };
}

function emptySupplyForm(): SupplyForm {
  return {
    name: '',
    category: 'Fertilizer',
    stock: '',
    unit: 'bags',
    referenceStock: '',
    lowStockThreshold: '',
  };
}

function parsePositiveAmount(raw: string): number | null {
  const normalized = raw.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeAmount(raw: string): number | null {
  const normalized = raw.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function EquipmentManagement() {
  const { state, loading, updateState, saving } = useFarmData();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EquipmentRecord | null>(null);
  const [fixingReportIndex, setFixingReportIndex] = useState<number | null>(null);
  const [repairCost, setRepairCost] = useState('');
  const [activeInventoryTab, setActiveInventoryTab] = useState<'fleet' | 'consumables'>('fleet');
  const [supplyFormOpen, setSupplyFormOpen] = useState(false);
  const [supplyForm, setSupplyForm] = useState<SupplyForm>(() => emptySupplyForm());

  // Search, Filter & Sort states
  const [supplySearchQuery, setSupplySearchQuery] = useState('');
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState('All');
  const [supplyStatusFilter, setSupplyStatusFilter] = useState('All');
  const [supplySortOrder, setSupplySortOrder] = useState<'name' | 'stock_asc' | 'stock_desc' | 'newest'>('newest');

  const [fleetSearchQuery, setFleetSearchQuery] = useState('');
  const [fleetCategoryFilter, setFleetCategoryFilter] = useState('All');
  const [fleetStatusFilter, setFleetStatusFilter] = useState('All');

  // Activity stock usage deduction state
  const [activityUsageOpen, setActivityUsageOpen] = useState(false);
  const [activityUsageSupply, setActivityUsageSupply] = useState<ConsumableSupplyRecord | null>(null);
  const [activityUsageQuantity, setActivityUsageQuantity] = useState('1');
  const [activityUsagePurpose, setActivityUsagePurpose] = useState('Crop Care / Plot Treatment');
  const [activityUsageWorker, setActivityUsageWorker] = useState('Juan Dela Cruz (Worker)');

  useEffect(() => {
    const handleScrollTarget = () => {
      const hash = window.location.hash;
      if (hash.includes('consumable') || hash.includes('supply')) {
        setActiveInventoryTab('consumables');
      }
    };
    handleScrollTarget();
    window.addEventListener('hashchange', handleScrollTarget);
    return () => window.removeEventListener('hashchange', handleScrollTarget);
  }, []);

  const consumables = state.consumableSupplies;
  const consumableReports = state.consumableReports ?? [];
  const pendingConsumableReports = consumableReports.filter((r) => !r.reviewed).length;

  const adjustConsumableStock = async (id: string, delta: number) => {
    const ok = await runSave('Consumable supply', () =>
      updateState((prev) => ({
        ...prev,
        consumableSupplies: prev.consumableSupplies.map((c) => {
          if (c.supplyId !== id) return c;
          const newStock = Math.max(0, c.stock + delta);
          const updated: ConsumableSupplyRecord = {
            ...c,
            stock: newStock,
            lastRestocked: delta > 0 ? new Date().toISOString().slice(0, 10) : c.lastRestocked,
          };
          return {
            ...updated,
            status: computeSupplyStatus(updated),
          };
        }),
      })),
    );
    if (!ok) showSaveError('Could not update supply stock.');
  };

  const recordActivityUsage = async () => {
    if (!activityUsageSupply) return;
    const qty = parsePositiveAmount(activityUsageQuantity);
    if (qty === null || qty <= 0) {
      showSaveError('Please enter a valid quantity consumed greater than zero.');
      return;
    }
    const deduction = Math.round(qty);
    if (deduction > activityUsageSupply.stock) {
      showSaveError(`Cannot deduct ${deduction} ${activityUsageSupply.unit}. Only ${activityUsageSupply.stock} available in stock.`);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const ok = await runSave('Activity stock usage', () =>
      updateState((prev) => ({
        ...prev,
        consumableSupplies: prev.consumableSupplies.map((c) => {
          if (c.supplyId !== activityUsageSupply.supplyId) return c;
          const newStock = Math.max(0, c.stock - deduction);
          const updated: ConsumableSupplyRecord = {
            ...c,
            stock: newStock,
          };
          return {
            ...updated,
            status: computeSupplyStatus(updated),
          };
        }),
        consumableReports: [
          ...(prev.consumableReports ?? []),
          {
            reportId: `ACT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            supplyId: activityUsageSupply.supplyId,
            supplyName: activityUsageSupply.name,
            reportedBy: activityUsageWorker,
            reportedAt: today,
            isRunOut: activityUsageSupply.stock - deduction <= 0,
            notes: `Consumed ${deduction} ${activityUsageSupply.unit} for "${activityUsagePurpose}". Remaining: ${Math.max(0, activityUsageSupply.stock - deduction)} ${activityUsageSupply.unit}.`,
            reviewed: true,
            reviewedAt: today,
            reviewedBy: 'Activity Auto-Log',
          },
        ],
      })),
    );
    if (ok) {
      setActivityUsageOpen(false);
      setActivityUsageSupply(null);
      setActivityUsageQuantity('1');
    }
  };

  const saveSupply = async () => {
    const name = supplyForm.name.trim();
    if (!name) {
      showSaveError('Supply name is required.');
      return;
    }
    const parsedStock = parseNonNegativeAmount(supplyForm.stock);
    if (parsedStock === null) {
      showSaveError('Enter a valid stock quantity.');
      return;
    }
    const stock = Math.round(parsedStock);
    const parsedRef = parsePositiveAmount(supplyForm.referenceStock);
    const referenceStock = parsedRef !== null ? Math.round(parsedRef) : Math.max(stock, 30);
    const parsedThreshold = parsePositiveAmount(supplyForm.lowStockThreshold);
    const lowStockThreshold = parsedThreshold !== null ? Math.round(parsedThreshold) : Math.ceil(referenceStock * 0.3);

    const partialRecord = {
      supplyId: `C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name,
      category: supplyForm.category.trim() || 'Other',
      stock,
      unit: supplyForm.unit.trim() || 'units',
      referenceStock,
      lowStockThreshold,
      lastRestocked: new Date().toISOString().slice(0, 10),
    };
    const record: ConsumableSupplyRecord = {
      ...partialRecord,
      status: computeSupplyStatus(partialRecord),
    };

    const ok = await runSave('Consumable supply', () =>
      updateState((prev) => ({
        ...prev,
        consumableSupplies: [...prev.consumableSupplies, record],
      })),
    );
    if (!ok) return;
    setSupplyForm(emptySupplyForm());
    setSupplyFormOpen(false);
  };

  const deleteSupply = async (id: string) => {
    if (!window.confirm('Delete this consumable supply?')) return;
    const ok = await runSave('Consumable supply', () =>
      updateState((prev) => ({
        ...prev,
        consumableSupplies: prev.consumableSupplies.filter((c) => c.supplyId !== id),
      })),
    );
    if (!ok) showSaveError('Could not delete supply.');
  };

  const markConsumableReportReviewed = async (report: ConsumableSupplyReportRecord) => {
    const reportKey =
      report.reportId ||
      [report.supplyId ?? '', report.supplyName, report.reportedAt, report.reportedBy].join('\u0001');
    const ok = await runSave('Consumable report', () =>
      updateState((prev) => ({
        ...prev,
        consumableReports: (prev.consumableReports ?? []).map((r) => {
          const key =
            r.reportId ||
            [r.supplyId ?? '', r.supplyName, r.reportedAt, r.reportedBy].join('\u0001');
          return key === reportKey
            ? {
                ...r,
                reviewed: true,
                reviewedAt: new Date().toISOString().slice(0, 10),
                reviewedBy: 'Admin',
              }
            : r;
        }),
      })),
    );
    if (!ok) showSaveError('Could not mark supply report reviewed.');
  };

  const equipmentData = useMemo(
    () =>
      state.equipment.map((e, id) => ({
        id,
        name: e.name,
        type: e.category,
        inventoryStatus: e.status,
        status: effectiveEquipmentStatus(e.name, e.status, state),
        lastMaintenance: latestMaintenanceLabel(state.maintenanceLogs, e.name),
        usageHours: sumUsageHoursForEquipment(state.usageLogs, e.name),
      })),
    [state],
  );

  const filteredConsumables = useMemo(() => {
    let list = [...consumables];
    if (supplySearchQuery.trim()) {
      const q = supplySearchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.supplyId.toLowerCase().includes(q),
      );
    }
    if (supplyCategoryFilter !== 'All') {
      list = list.filter((c) => c.category.toLowerCase() === supplyCategoryFilter.toLowerCase());
    }
    if (supplyStatusFilter !== 'All') {
      list = list.filter((c) => {
        const threshold = computeLowStockThreshold(c);
        if (supplyStatusFilter === 'Out of Stock') return c.stock <= 0;
        if (supplyStatusFilter === 'Low Stock') return c.stock > 0 && c.stock <= threshold;
        if (supplyStatusFilter === 'In Stock') return c.stock > threshold;
        return true;
      });
    }
    if (supplySortOrder === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (supplySortOrder === 'stock_asc') {
      list.sort((a, b) => a.stock - b.stock);
    } else if (supplySortOrder === 'stock_desc') {
      list.sort((a, b) => b.stock - a.stock);
    }
    return list;
  }, [consumables, supplySearchQuery, supplyCategoryFilter, supplyStatusFilter, supplySortOrder]);

  const filteredEquipment = useMemo(() => {
    let list = [...equipmentData];
    if (fleetSearchQuery.trim()) {
      const q = fleetSearchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q));
    }
    if (fleetCategoryFilter !== 'All') {
      list = list.filter((e) => e.type.toLowerCase() === fleetCategoryFilter.toLowerCase());
    }
    if (fleetStatusFilter !== 'All') {
      list = list.filter((e) => e.status.toLowerCase() === fleetStatusFilter.toLowerCase());
    }
    return list;
  }, [equipmentData, fleetSearchQuery, fleetCategoryFilter, fleetStatusFilter]);

  const statusDistribution = useMemo(() => buildEquipmentStatusSlices(state), [state]);

  const maintenanceMonthly = useMemo(
    () => buildMaintenanceMonthlyChart(state),
    [state.maintenanceLogs, state.equipmentReports, state.equipment],
  );

  const usageData = useMemo(() => buildUsageByEquipmentChart(state), [state.usageLogs]);

  const availableCount = equipmentData.filter((e) => e.status === 'available').length;
  const maintenanceIssueCount = pendingMaintenanceIssueCount(state);
  const damagedCount = equipmentData.filter((e) => e.status === 'damaged').length;
  const pendingWreckedCount = equipmentData.filter((e) => e.status === 'damaged').length;

  const workerReports = useMemo(() => {
    const reports = state.equipmentReports.map((report, index) => ({
      kind: 'report' as const,
      report,
      index,
      sortDate: report.reportedAt || '',
    }));
    const linkedMaintenanceKeys = new Set(
      reports.map((r) =>
        [
          r.report.equipmentName.trim().toLowerCase(),
          r.report.reportedAt || '',
          r.report.notes.trim(),
        ].join('\u0001'),
      ),
    );
    const fromMaintenance = state.maintenanceLogs
      .map((log, index) => ({
        kind: 'maintenance' as const,
        log,
        index,
        sortDate: log.date ?? '',
      }))
      .filter((entry) => {
        const key = [
          entry.log.equipmentName.trim().toLowerCase(),
          entry.log.date ?? '',
          entry.log.details.trim(),
        ].join('\u0001');
        return entry.log.details.trim().length > 0 && !linkedMaintenanceKeys.has(key);
      });
    return [...reports, ...fromMaintenance].sort((a, b) => {
      const timeA = Date.parse(a.sortDate || '') || 0;
      const timeB = Date.parse(b.sortDate || '') || 0;
      if (timeA !== timeB) return timeB - timeA;
      return (b.sortDate || '').localeCompare(a.sortDate || '');
    });
  }, [state.equipmentReports, state.maintenanceLogs]);

  const pendingReportCount = workerReports.filter(
    (r) =>
      r.kind === 'report' &&
      !r.report.reviewed &&
      !r.report.fixedAt &&
      !r.report.isFixedReport,
  ).length;

  const markReportReviewed = async (index: number, applyBrokenStatus: boolean) => {
    const report = state.equipmentReports[index];
    if (!report) return;
    const targetId = report.reportId;
    const ok = await runSave('Equipment report', () =>
      updateState((prev) => {
        const equipmentReports = prev.equipmentReports.map((r, i) =>
          (targetId && r.reportId === targetId) || i === index ? { ...r, reviewed: true } : r,
        );
        if (!applyBrokenStatus || !report.isWrecked) {
          return { ...prev, equipmentReports };
        }
        const eqIdx = prev.equipment.findIndex(
          (e) => e.name.trim().toLowerCase() === report.equipmentName.trim().toLowerCase(),
        );
        if (eqIdx < 0) return { ...prev, equipmentReports };
        const equipment = prev.equipment.map((e, i) =>
          i === eqIdx ? { ...e, status: 'broken' } : e,
        );
        return { ...prev, equipmentReports, equipment };
      }),
    );
    if (!ok) showSaveError('Could not update the report.');
  };

  const openFixReportDialog = (index: number) => {
    setFixingReportIndex(index);
    setRepairCost('');
  };

  const closeFixReportDialog = () => {
    setFixingReportIndex(null);
    setRepairCost('');
  };

  const markReportFixed = async () => {
    if (fixingReportIndex === null) return;
    const parsedRepairCost = parsePositiveAmount(repairCost);
    if (parsedRepairCost === null) {
      showSaveError('Enter a valid repair cost greater than zero.');
      return;
    }
    const index = fixingReportIndex;
    const report = state.equipmentReports[index];
    if (!report) return;
    const targetId = report.reportId;
    const today = new Date().toISOString().slice(0, 10);
    const normalizedCost = `₱${Math.round(parsedRepairCost).toLocaleString()}`;
    const ok = await runSave('Equipment fixed', () =>
      updateState((prev) => {
        const equipmentReports = prev.equipmentReports.map((r, i) =>
          (targetId && r.reportId === targetId) || i === index
            ? {
                ...r,
                reviewed: true,
                fixedAt: today,
                fixedBy: 'Admin',
              }
            : r,
        );
        const eqIdx = prev.equipment.findIndex(
          (e) => e.name.trim().toLowerCase() === report.equipmentName.trim().toLowerCase(),
        );
        const equipment =
          eqIdx >= 0
            ? prev.equipment.map((e, i) => (i === eqIdx ? { ...e, status: 'available' } : e))
            : prev.equipment;
        const fixNote = report.notes.trim()
          ? `Marked fixed: ${report.notes.trim()}`
          : 'Marked fixed / repaired';
        const maintenanceLogs = [
          ...prev.maintenanceLogs,
          {
            equipmentName: report.equipmentName,
            details: fixNote,
            costText: normalizedCost,
            date: today,
          },
        ];
        return { ...prev, equipmentReports, equipment, maintenanceLogs };
      }),
    );
    if (ok) closeFixReportDialog();
    else showSaveError('Could not mark equipment as fixed.');
  };

  const closeEquipmentDialog = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const openAddEquipment = () => {
    setEditingIndex(-1);
    setEditForm(emptyEquipmentRecord());
  };

  const saveEquipment = async () => {
    if (!editForm?.name.trim()) {
      showSaveError('Equipment name is required.');
      return;
    }
    const isNew = editingIndex === -1;
    const existing = !isNew && editingIndex !== null ? state.equipment[editingIndex] : null;
    const record: EquipmentRecord = {
      name: editForm.name.trim(),
      category: editForm.category.trim() || 'Other',
      status: isNew ? 'available' : existing?.status?.trim() || editForm.status.trim() || 'available',
      assignedTo: null,
      currentValue: editForm.currentValue ?? 0,
    };
    const ok = await runSave('Equipment', () =>
      updateState((prev) => ({
        ...prev,
        equipment: isNew
          ? [...prev.equipment, record]
          : prev.equipment.map((e, i) => (i === editingIndex ? record : e)),
      })),
    );
    if (ok) closeEquipmentDialog();
  };

  const deleteEquipment = async () => {
    if (editingIndex === null || editingIndex < 0) return;
    if (!window.confirm('Remove this equipment from inventory?')) return;
    const ok = await runSave('Equipment', () =>
      updateState((prev) => ({
        ...prev,
        equipment: prev.equipment.filter((_, i) => i !== editingIndex),
      })),
    );
    if (ok) closeEquipmentDialog();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1>Monitoring Farm Inventory and Equipment</h1>
        <p className="text-muted-foreground">Loading from Firebase…</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-[1600px] mx-auto pb-8 font-sans"
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
              Equipment & Fleet Management
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Fleet Status
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Monitor farm machinery, track fleet maintenance schedules, review condition reports, and manage supplies.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Equipment</p>
              <p className="text-2xl font-bold font-heading text-foreground">{equipmentData.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available</p>
              <p className="text-2xl font-bold font-heading text-foreground">{availableCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open issues</p>
              <p className="text-2xl font-bold font-heading text-foreground">{maintenanceIssueCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Need Repair</p>
              <p className="text-2xl font-bold font-heading text-foreground">{damagedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editForm !== null} onOpenChange={(o) => { if (!o) closeEquipmentDialog(); }}>
        <DialogContent className="sm:max-w-lg bg-card text-card-foreground border-border/80">
          <DialogHeader>
            <DialogTitle>{editingIndex === -1 ? 'Add equipment' : 'Edit equipment'}</DialogTitle>
          </DialogHeader>
          {editForm ? (
            <div className="grid gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                Inventory is managed here on the website. Workers see this list in the mobile app when reporting issues.
              </p>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <SelectWithOther
                label="Category"
                value={editForm.category}
                onChange={(cat) => setEditForm({ ...editForm, category: cat })}
                options={EQUIPMENT_CATEGORIES}
                selectClassName={SELECT_CLASS}
                otherPlaceholder="Type custom equipment category..."
              />
              <div className="space-y-2">
                <Label>Value (₱)</Label>
                <Input
                  type="number"
                  value={editForm.currentValue}
                  onChange={(e) => setEditForm({ ...editForm, currentValue: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            {editingIndex !== null && editingIndex >= 0 ? (
              <Button variant="outline" className="text-[#d4183d] border-[#d4183d]/30" disabled={saving} onClick={() => void deleteEquipment()}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeEquipmentDialog}>
                Cancel
              </Button>
              <Button className="bg-[#2d5016] text-white" disabled={saving} onClick={() => void saveEquipment()}>
                {saving ? 'Saving…' : editingIndex === -1 ? 'Add' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fixingReportIndex !== null} onOpenChange={(o) => { if (!o) closeFixReportDialog(); }}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border/80">
          <DialogHeader>
            <DialogTitle>Record repair cost</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              Enter the amount spent to repair this equipment before marking it fixed.
            </p>
            <div className="space-y-2">
              <Label>Repair cost (₱)</Label>
              <Input
                type="number"
                min="0"
                value={repairCost}
                onChange={(e) => setRepairCost(e.target.value)}
                placeholder="120"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeFixReportDialog}>
              Cancel
            </Button>
            <Button className="bg-[#2d5016] text-white" disabled={saving} onClick={() => void markReportFixed()}>
              {saving ? 'Saving…' : 'Mark fixed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supplyFormOpen} onOpenChange={setSupplyFormOpen}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border/80">
          <DialogHeader>
            <DialogTitle>Add consumable supply</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Supplies are saved to Firebase and mirrored with the shared farm database.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Supply Name *</Label>
              <Input
                value={supplyForm.name}
                onChange={(e) => setSupplyForm({ ...supplyForm, name: e.target.value })}
                placeholder="Sample: Organic Nitrogen Fertilizer"
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectWithOther
                label="Category"
                value={supplyForm.category}
                onChange={(cat) => setSupplyForm({ ...supplyForm, category: cat })}
                options={SUPPLY_CATEGORIES}
                selectClassName={SELECT_CLASS}
                otherPlaceholder="Type custom supply category..."
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Unit of Measure</Label>
                <Input
                  value={supplyForm.unit}
                  onChange={(e) => setSupplyForm({ ...supplyForm, unit: e.target.value })}
                  placeholder="Sample: bags, liters, kg"
                  className="text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Current Stock *</Label>
                <Input
                  type="number"
                  min="0"
                  value={supplyForm.stock}
                  onChange={(e) => setSupplyForm({ ...supplyForm, stock: e.target.value })}
                  placeholder="Sample: 50"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Base Stock</Label>
                <Input
                  type="number"
                  min="1"
                  value={supplyForm.referenceStock}
                  onChange={(e) => setSupplyForm({ ...supplyForm, referenceStock: e.target.value })}
                  placeholder="Sample: 50"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">30% Threshold</Label>
                <Input
                  type="number"
                  min="1"
                  value={supplyForm.lowStockThreshold}
                  onChange={(e) => setSupplyForm({ ...supplyForm, lowStockThreshold: e.target.value })}
                  placeholder="Sample: 15"
                  className="text-xs"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
              💡 <strong>Low Stock Threshold:</strong> When stock drops below 30% of base capacity (or custom threshold), the system automatically creates a low-stock alert in the notification center.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSupplyFormOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button className="bg-[#2d5016] text-white hover:bg-[#234012] text-xs" disabled={saving || !supplyForm.name.trim()} onClick={() => void saveSupply()}>
              {saving ? 'Saving…' : 'Add supply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Activity Stock Usage Dialog */}
      <Dialog open={activityUsageOpen} onOpenChange={setActivityUsageOpen}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold font-heading">
              <MinusCircle className="w-5 h-5 text-amber-500" />
              Record Activity Stock Usage
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Deduct inventory quantity used in farm field operations and auto-log the activity.
            </DialogDescription>
          </DialogHeader>

          {activityUsageSupply && (
            <div className="grid gap-3.5 py-2">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">{activityUsageSupply.name}</p>
                  <p className="text-[11px] text-muted-foreground">Category: {activityUsageSupply.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-bold text-foreground">
                    {activityUsageSupply.stock} {activityUsageSupply.unit} available
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    Low-stock threshold: {computeLowStockThreshold(activityUsageSupply)} {activityUsageSupply.unit}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Quantity to Deduct ({activityUsageSupply.unit}) *</Label>
                <Input
                  type="number"
                  min="1"
                  max={activityUsageSupply.stock}
                  value={activityUsageQuantity}
                  onChange={(e) => setActivityUsageQuantity(e.target.value)}
                  placeholder="Sample: 2"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Farm Activity / Purpose *</Label>
                <Input
                  value={activityUsagePurpose}
                  onChange={(e) => setActivityUsagePurpose(e.target.value)}
                  placeholder="Sample: Monthly Pest Spraying on Plot Sector B"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned Worker / Operator</Label>
                <select
                  value={activityUsageWorker}
                  onChange={(e) => setActivityUsageWorker(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
                >
                  {[...state.workers]
                    .sort((a, b) => {
                      const aActive = isWorkerActive(a) ? 1 : 0;
                      const bActive = isWorkerActive(b) ? 1 : 0;
                      return bActive - aActive;
                    })
                    .map((w) => {
                      const active = isWorkerActive(w);
                      return (
                        <option key={w.workerId || w.name} value={`${w.name} (${w.roleRate})`}>
                          {w.name} ({w.roleRate}){active ? '' : ' — (Inactive)'}
                        </option>
                      );
                    })}
                  <option value="Admin / Inventory Manager">Admin / Inventory Manager</option>
                </select>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                * Decreases remaining stock and logs consumption report for audit trail.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActivityUsageOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              disabled={saving || !activityUsageQuantity || Number(activityUsageQuantity) <= 0}
              onClick={() => void recordActivityUsage()}
            >
              {saving ? 'Deducting…' : 'Deduct Stock & Log Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="mb-1">Worker equipment reports</h3>
            <p className="text-sm text-muted-foreground">
              Submitted from the mobile app when staff report wrecked or working equipment.
            </p>
          </div>
          {pendingReportCount > 0 ? (
            <span className="text-xs px-3 py-1 rounded-full bg-[#d4183d] text-white shrink-0">
              {pendingReportCount} pending
            </span>
          ) : null}
        </div>
        {workerReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No worker reports yet.</p>
        ) : (
          <div id="equipment-reports-section" className={`space-y-3 max-h-[360px] ${SCROLL_PANEL_CLASS}`}>
            {workerReports.map((entry) =>
              entry.kind === 'report' ? (
                <WorkerEquipmentReportCard
                  key={entry.report.reportId || `${entry.report.equipmentName}-${entry.report.reportedAt}-${entry.index}`}
                  report={entry.report}
                  index={entry.index}
                  saving={saving}
                  onMarkReviewed={markReportReviewed}
                  onMarkFixed={openFixReportDialog}
                  workers={state.workers}
                />
              ) : (
                <MaintenanceLogReportCard
                  key={`maint-${entry.log.equipmentName}-${entry.log.date}-${entry.index}`}
                  log={entry.log}
                />
              ),
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">

          {/* Custom Tab Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/70 pb-4 mb-6 gap-3">
            <div className="flex bg-muted/40 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveInventoryTab('fleet')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeInventoryTab === 'fleet'
                    ? 'bg-[#2d5016] text-white shadow'
                    : 'text-muted-foreground hover:bg-[#4a2c2a]/5'
                }`}
              >
                Fleet & Machinery ({equipmentData.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveInventoryTab('consumables')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeInventoryTab === 'consumables'
                    ? 'bg-[#2d5016] text-white shadow'
                    : 'text-muted-foreground hover:bg-[#4a2c2a]/5'
                }`}
              >
                Consumable Supplies ({consumables.length})
                {pendingConsumableReports > 0 ? ` · ${pendingConsumableReports} report${pendingConsumableReports === 1 ? '' : 's'}` : ''}
              </button>
            </div>

            {activeInventoryTab === 'fleet' ? (
              <Button className="bg-[#2d5016] text-white text-xs px-3 py-1.5 shrink-0" onClick={openAddEquipment}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Equipment
              </Button>
            ) : (
              <Button
                className="bg-[#2d5016] text-white text-xs px-3 py-1.5 shrink-0"
                onClick={() => setSupplyFormOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Supply
              </Button>
            )}
          </div>

          {activeInventoryTab === 'fleet' ? (
            <div className="space-y-3">
              {/* Fleet Search & Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3">
                <div className="sm:col-span-6 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search equipment machinery..."
                    value={fleetSearchQuery}
                    onChange={(e) => setFleetSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs bg-background/80"
                  />
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={fleetCategoryFilter}
                    onChange={(e) => setFleetCategoryFilter(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
                  >
                    <option value="All">All Categories</option>
                    {EQUIPMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={fleetStatusFilter}
                    onChange={(e) => setFleetStatusFilter(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
                  >
                    <option value="All">All Statuses</option>
                    <option value="available">Available</option>
                    <option value="in-use">In-Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
              </div>

              <div className={`space-y-3 max-h-[560px] ${SCROLL_PANEL_CLASS}`}>
                {filteredEquipment.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center font-mono">
                    {fleetSearchQuery || fleetCategoryFilter !== 'All'
                      ? 'No equipment matches the search criteria.'
                      : 'No equipment registered yet.'}
                  </p>
                ) : null}
                {filteredEquipment.map((equipment) => (
                  <div
                    key={equipment.id}
                    className="bg-muted/40 rounded-xl p-4 border border-border/60 hover:border-border/80 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-background/80 flex items-center justify-center border border-border/60">
                          <Wrench className="w-6 h-6 text-foreground" />
                        </div>
                        <div className="flex-1">
                          <h4 className="mb-1 font-bold text-foreground">{equipment.name}</h4>
                          <p className="text-xs text-muted-foreground">{equipment.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-label={`Edit ${equipment.name}`}
                          className="w-8 h-8 rounded-lg bg-background/80 border border-border/70 hover:bg-[#4a2c2a] hover:text-white flex items-center justify-center"
                          onClick={() => {
                            const rec = state.equipment[equipment.id];
                            if (!rec) return;
                            setEditingIndex(equipment.id);
                            setEditForm({ ...rec });
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-xs px-3 py-1 rounded-full ${
                              equipment.status === 'available'
                                ? 'bg-[#2d5016] text-white'
                                : equipment.status === 'in-use'
                                ? 'bg-[#4a2c2a] text-white'
                                : equipment.status === 'maintenance'
                                ? 'bg-[#d4a574] text-white'
                                : 'bg-[#d4183d] text-white'
                            }`}
                          >
                            {equipment.status}
                          </span>
                          {mapEquipStatus(equipment.inventoryStatus) !== equipment.status ? (
                            <span className="text-[10px] text-muted-foreground">
                              On file: {equipment.inventoryStatus}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3 bg-background/50 rounded-lg p-3 backdrop-blur-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Usage Hours</p>
                        <p className="text-sm font-semibold text-foreground">{equipment.usageHours}h</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Last Maintenance</p>
                        <p className="text-sm font-semibold text-foreground">{equipment.lastMaintenance}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t border-border/60">
                      <Calendar className="w-3 h-3" />
                      <span>Usage total: {equipment.usageHours}h logged</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Consumable Search, Filter & Sort */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-5 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search supplies, fertilizers, chemicals..."
                    value={supplySearchQuery}
                    onChange={(e) => setSupplySearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs bg-background/80"
                  />
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={supplyCategoryFilter}
                    onChange={(e) => setSupplyCategoryFilter(e.target.value)}
                    className="w-full h-9 px-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
                  >
                    <option value="All">All Categories</option>
                    {SUPPLY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={supplyStatusFilter}
                    onChange={(e) => setSupplyStatusFilter(e.target.value)}
                    className="w-full h-9 px-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Low Stock">⚠️ Low Stock (≤30%)</option>
                    <option value="Out of Stock">🚫 Out of Stock</option>
                    <option value="In Stock">✅ In Stock</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={supplySortOrder}
                    onChange={(e) => setSupplySortOrder(e.target.value as 'name' | 'stock_asc' | 'stock_desc' | 'newest')}
                    className="w-full h-9 px-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="stock_asc">Sort: Stock (Low to High)</option>
                    <option value="stock_desc">Sort: Stock (High to Low)</option>
                    <option value="name">Sort: Name (A–Z)</option>
                  </select>
                </div>
              </div>

              <div className={`space-y-3 max-h-[540px] ${SCROLL_PANEL_CLASS}`}>
                <div className="bg-background/80 rounded-xl p-4 border border-border/60">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-bold text-foreground">Worker supply reports</h4>
                      <p className="text-xs text-muted-foreground">
                        Mobile reports show whether consumables ran out or still have stock.
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground uppercase">
                      {pendingConsumableReports} pending
                    </span>
                  </div>
                  {consumableReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No worker supply reports yet.</p>
                  ) : (
                    <div id="consumable-reports-section" className="space-y-2">
                      {consumableReports
                        .slice()
                        .sort((a, b) => {
                          const timeA = Date.parse(a.reportedAt || '') || 0;
                          const timeB = Date.parse(b.reportedAt || '') || 0;
                          if (timeA !== timeB) return timeB - timeA;
                          return (b.reportedAt || '').localeCompare(a.reportedAt || '');
                        })
                        .slice(0, 10)
                        .map((report, index) => {
                          const isRunOut = Boolean(report.isRunOut);
                          return (
                            <div
                              key={report.reportId || `${report.supplyName}-${report.reportedAt}-${index}`}
                              id={report.reportId ? `supply-${report.reportId}` : undefined}
                              className="rounded-lg bg-muted/40 border border-border/60 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-foreground truncate">
                                    {report.supplyName || 'Consumable supply'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {report.reportedAt || 'No date'} · {report.reportedBy || 'Unknown worker'}
                                  </p>
                                </div>
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                                    isRunOut ? 'bg-[#d4183d] text-white' : 'bg-[#2d5016] text-white'
                                  }`}
                                >
                                  {isRunOut ? 'Run out' : 'Available'}
                                </span>
                              </div>
                              {report.notes ? (
                                <p className="text-xs text-muted-foreground mt-2">{report.notes}</p>
                              ) : null}
                              <div className="flex items-center justify-between gap-2 mt-3">
                                <p className="text-[10px] text-muted-foreground">
                                  {report.reviewed ? `Reviewed ${report.reviewedAt || ''}` : 'Needs admin review'}
                                </p>
                                {!report.reviewed ? (
                                  <button
                                    type="button"
                                    onClick={() => void markConsumableReportReviewed(report)}
                                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-background/80 border border-border/70 hover:bg-[#2d5016] hover:text-white transition-all"
                                  >
                                    Mark reviewed
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {filteredConsumables.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center font-mono">
                    {supplySearchQuery || supplyCategoryFilter !== 'All' || supplyStatusFilter !== 'All'
                      ? 'No consumable supplies match your filter criteria.'
                      : 'No consumable supplies registered yet.'}
                  </p>
                ) : null}

                {filteredConsumables.map((item) => {
                  const threshold = computeLowStockThreshold(item);
                  const isOutOfStock = item.stock <= 0;
                  const isLowStock = !isOutOfStock && item.stock <= threshold;

                  const statusBadge = isOutOfStock
                    ? 'bg-[#d4183d] text-white'
                    : isLowStock
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                    : 'bg-[#2d5016] text-white';

                  return (
                    <div
                      key={item.supplyId}
                      className={`rounded-xl p-4 border transition-all ${
                        isLowStock
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : isOutOfStock
                          ? 'bg-destructive/5 border-destructive/30'
                          : 'bg-muted/40 border-border/60 hover:border-border/80'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-12 h-12 rounded-lg bg-background/80 flex items-center justify-center font-bold text-[10px] text-muted-foreground border border-border/60 shrink-0">
                            {item.category.slice(0, 4).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="mb-1 truncate font-bold text-foreground">{item.name}</h4>
                            <p className="text-xs text-muted-foreground">Category: {item.category}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${statusBadge}`}>
                            {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock (≤30%)' : 'In Stock'}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {item.supplyId}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3 bg-background/50 rounded-lg p-3 backdrop-blur-sm">
                        <div className="flex flex-col justify-center">
                          <p className="text-xs text-muted-foreground mb-0.5">Current Stock Level</p>
                          <p className="text-base font-extrabold text-foreground">
                            {item.stock} <span className="text-xs font-semibold text-muted-foreground">{item.unit}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            30% Threshold: <span className="font-bold">{threshold} {item.unit}</span>
                          </p>
                        </div>
                        <div className="flex flex-col items-end justify-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void adjustConsumableStock(item.supplyId, 5)}
                              className="px-2.5 h-7 rounded-lg bg-background/80 border border-border/70 hover:bg-[#2d5016] hover:text-white flex items-center justify-center font-bold text-xs shadow-sm transition-all"
                              title="Restock 5 units"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={() => void adjustConsumableStock(item.supplyId, -1)}
                              disabled={item.stock === 0}
                              className="px-2.5 h-7 rounded-lg bg-background/80 border border-border/70 hover:bg-[#d4183d] hover:text-white flex items-center justify-center font-bold text-xs shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-background/80 disabled:hover:text-inherit"
                              title="Deduct 1 unit"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteSupply(item.supplyId)}
                              className="w-7 h-7 rounded-lg bg-background/80 border border-[#d4183d]/20 text-[#d4183d] hover:bg-[#d4183d] hover:text-white flex items-center justify-center shadow-sm transition-all"
                              title="Delete supply"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActivityUsageSupply(item);
                              setActivityUsageQuantity('1');
                              setActivityUsagePurpose(`Plot Treatment with ${item.name}`);
                              setActivityUsageOpen(true);
                            }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                            title="Record field consumption"
                          >
                            <MinusCircle className="w-3 h-3" />
                            Use in Activity
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>Last restocked: {item.lastRestocked}</span>
                        </div>
                        {item.referenceStock && (
                          <span>Base capacity: {item.referenceStock} {item.unit}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <ChartPanel
            title="Equipment status"
            subtitle="Includes app maintenance notes (e.g. nasira) and worker reports, not only inventory status"
            height={260}
            empty={!chartPieHasData(statusDistribution)}
            emptyMessage="Add equipment or worker reports to see status."
            legend={
              statusDistribution.length > 0 ? (
                <ChartLegendList
                  items={statusDistribution.map((item) => ({
                    name: item.name,
                    value: item.value,
                    color: item.color,
                  }))}
                />
              ) : null
            }
          >
            <ColoredDonutChart data={statusDistribution} innerRadius={52} outerRadius={88} />
          </ChartPanel>

          <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
            <h3 className="mb-4">Needs attention</h3>
            <div className={`space-y-3 max-h-[300px] ${SCROLL_PANEL_CLASS}`}>
              {pendingWreckedCount > 0 ? (
                <p className="text-xs text-muted-foreground mb-2">
                  {pendingWreckedCount} item{pendingWreckedCount === 1 ? '' : 's'} flagged from app notes or reports
                </p>
              ) : null}
              {equipmentData
                .filter((e) => e.status === 'maintenance' || e.status === 'damaged')
                .slice(0, 5)
                .map((equipment, idx) => (
                  <div key={idx} className="bg-muted/40 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm">{equipment.name}</h4>
                      {equipment.status === 'damaged' && (
                        <AlertTriangle className="w-4 h-4 text-[#d4183d]" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last service: {equipment.lastMaintenance}
                    </p>
                  </div>
                ))}
              {equipmentData.filter((e) => e.status === 'maintenance' || e.status === 'damaged').length === 0 &&
              pendingWreckedCount === 0 ? (
                <p className="text-sm text-muted-foreground">No equipment flagged for repair.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel
          title="Maintenance activity"
          subtitle="Service logs, worker reports, and equipment marked in maintenance (current month)"
          height={300}
          empty={!maintenanceChartHasData(maintenanceMonthly, state)}
          emptyMessage="No maintenance logs, worker reports, or equipment in maintenance yet."
        >
          <BarChart data={maintenanceMonthly} margin={farmChartBottomMargin}>
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...farmMonthXAxisProps} />
            <YAxis tick={farmAxisTick} allowDecimals={false} width={44} axisLine={false} tickLine={false} />
            <Tooltip
              {...farmTooltipProps}
              formatter={(value: number | string, name: string) => {
                const n = typeof value === 'number' ? value : Number(value);
                if (name === 'Spend (₱)') {
                  return [pesoFormatter(Number.isFinite(n) ? n : 0), name] as [string, string];
                }
                if (name === 'In maintenance (fleet)' || name === 'Logs & reports') {
                  return countTooltipFormatter(n, name);
                }
                return countTooltipFormatter(n, name);
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="logs"
              fill={CHART_COLORS.tertiary}
              name="Logs & reports"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              dataKey="inMaintenance"
              fill={CHART_EQUIPMENT_STATUS.maintenance}
              name="In maintenance (fleet)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              dataKey="costPeso"
              fill={CHART_COLORS.accent}
              name="Spend (₱)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartPanel>

        <ChartPanel
          title="Equipment usage"
          subtitle="Total hours logged per machine (all usage entries summed)"
          height={300}
          empty={!chartMonetarySeriesHasData(usageData, ['hours'])}
          emptyMessage="No usage hours logged from the app yet."
        >
          <BarChart data={usageData} layout="vertical" margin={CHART_MARGIN_WITH_BOTTOM_LABELS}>
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis type="number" tick={farmAxisTick} width={48} allowDecimals axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="equipment"
              tick={farmAxisTick}
              width={120}
              tickFormatter={(v) => truncateLabel(String(v), 16)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              {...farmTooltipProps}
              formatter={(value: number | string) => {
                const n = typeof value === 'number' ? value : Number(value);
                const hrs = Number.isFinite(n) ? n : 0;
                return [`${hrs.toLocaleString('en-PH')} h`, 'Usage'] as [string, string];
              }}
            />
            <Bar
              dataKey="hours"
              fill={CHART_COLORS.primary}
              name="Usage"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartPanel>
      </div>
    </motion.div>
  );
}

function MaintenanceLogReportCard({ log }: { log: MaintenanceRecord }) {
  return (
    <div className="rounded-xl p-4 border bg-destructive/10 border-[#d4183d]/25">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="font-medium">{log.equipmentName}</h4>
          <p className="text-sm text-muted-foreground">{log.date ?? '—'}</p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-[#4a2c2a] text-white">
          Maintenance note (app)
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-2">{log.details}</p>
      <p className="text-xs text-muted-foreground">
        Submitted from the app maintenance log. New submissions also appear as formal worker reports.
      </p>
    </div>
  );
}

function WorkerEquipmentReportCard({
  report,
  index,
  saving,
  onMarkReviewed,
  onMarkFixed,
  workers,
}: {
  report: EquipmentConditionReport;
  index: number;
  saving: boolean;
  onMarkReviewed: (index: number, applyBrokenStatus: boolean) => Promise<void>;
  onMarkFixed: (index: number) => void | Promise<void>;
  workers?: WorkerRecord[];
}) {
  const isFixed = isEquipmentFixedReport(report);
  const isResolved = Boolean(report.reviewed || report.fixedAt);

  const reporterName = report.reportedBy?.trim().toLowerCase();
  const reporterWorker = reporterName && workers
    ? workers.find(w => w.name.trim().toLowerCase() === reporterName || w.accountEmail?.trim().toLowerCase() === reporterName)
    : null;
  const isReporterInactive = reporterWorker
    ? parseWorkerDetails(reporterWorker.details).status === 'inactive'
    : false;

  return (
    <div
      id={report.reportId ? `equipment-${report.reportId}` : undefined}
      className={`rounded-xl p-4 border ${
        isFixed
          ? 'bg-emerald-500/10 border-[#2d5016]/25'
          : isResolved
            ? 'bg-muted/40 border-border/60'
            : 'bg-destructive/10 border-[#d4183d]/25'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="font-medium">{report.equipmentName}</h4>
          <p className="text-sm text-muted-foreground">
            {report.reportedAt}
            {report.reportedBy ? ` · ${report.reportedBy}` : ''}
            {isReporterInactive ? ' (inactive)' : ''}
          </p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${equipmentReportBadgeClass(report)}`}>
          {equipmentReportConditionLabel(report)}
        </span>
      </div>
      {report.notes ? (
        <p className="text-sm text-muted-foreground mb-3">{report.notes}</p>
      ) : null}
      {report.fixedAt ? (
        <p className="text-xs text-[#2d5016] font-medium mb-2">
          Fixed on {report.fixedAt}
          {report.fixedBy ? ` · ${report.fixedBy}` : ''}
        </p>
      ) : null}
      {isResolved ? (
        <p className="text-xs text-[#2d5016] font-medium">
          {isFixed ? 'Repair recorded' : 'Reviewed'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {report.isWrecked && !isFixed ? (
            <Button
              size="sm"
              className="bg-[#2d5016] text-white hover:bg-[#234012]"
              disabled={saving}
              onClick={() => void onMarkFixed(index)}
            >
              Mark as fixed
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => void onMarkReviewed(index, false)}
          >
            Mark reviewed
          </Button>
          {report.isWrecked && !isFixed ? (
            <Button
              size="sm"
              className="bg-[#d4183d] text-white hover:bg-[#b01534]"
              disabled={saving}
              onClick={() => void onMarkReviewed(index, true)}
            >
              Mark reviewed & set broken
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
