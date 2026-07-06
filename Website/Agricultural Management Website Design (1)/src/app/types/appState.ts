/** Shared farm snapshot — matches Android Gson [AppState]. */

export interface WorkerRecord {
  name: string;
  roleRate: string;
  details?: string;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: string;
  workerId?: string;
  birthday?: string;
  sex?: string;
  accountEmail?: string;
  accountPassword?: string;
  authUid?: string;
}

export interface AttendanceRecord {
  workerName: string;
  details: string;
  hoursWorked?: number | null;
  clockIn?: string;
  clockOut?: string;
  date?: string;
  attendanceId?: string;
  awaitingPayrollLine?: boolean;
  submittedByStaff?: boolean;
}

export interface TaskRecord {
  title: string;
  details: string;
  status: string;
}

export interface SectionRecord {
  name: string;
  details: string;
}

export interface TreeRecord {
  sectionName: string;
  details: string;
  stage: string;
  treeId?: string;
  farmBlockName?: string;
}

export interface TreeRipenessScanRecord {
  treeId: string;
  ripenessLabel: string;
  timestampMillis: number;
  sourceGrade?: string | null;
}

export interface HarvestScheduleRecord {
  sectionName: string;
  details: string;
  status: string;
  farmBlockName?: string;
}

export interface HarvestReadinessReportRecord {
  reportId: string;
  zone: string;
  expectedWeight: string;
  reportedBy: string;
  reportedAt: string;
  status: 'Pending Review' | 'Approved' | 'Rejected' | string;
  notes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface FloweringRecord {
  sectionName: string;
  details: string;
  intensity: string;
  farmBlockName?: string;
}

export interface CherryHarvestRecord {
  batchId: string;
  pickerWorkerName?: string | null;
  details: string;
  weightText: string;
  date?: string | null;
  harvestId?: string;
  farmBlock?: string;
  qualityNotes?: string;
}

export interface BatchRecord {
  batchId: string;
  label: string;
  status: string;
  treeId?: string | null;
  ripenessScore?: number | null;
  createdAtMillis?: number | null;
}

export interface CherryGradeRecord {
  batchId?: string | null;
  grade?: string | null;
  confidence?: string | null;
  species?: string | null;
  speciesConfidence?: string | null;
  savedAtMillis?: number | null;
  treeId?: string | null;
  scannedByWorkerName?: string | null;
  scannedByEmail?: string | null;
  scannedByAuthUid?: string | null;
}

export interface EquipmentRecord {
  name: string;
  category: string;
  status: string;
  assignedTo: string | null;
  currentValue: number;
}

export interface UsageLogRecord {
  equipmentName: string;
  details: string;
  hoursText: string;
}

export interface MaintenanceRecord {
  equipmentName: string;
  details: string;
  costText: string;
  date?: string | null;
}

/** Field report from a worker (mobile app) — visible to admins on the website. */
export interface EquipmentConditionReport {
  reportId: string;
  equipmentName: string;
  /** true = wrecked / broken; false = working OK or fixed */
  isWrecked: boolean;
  notes: string;
  reportedAt: string;
  reportedBy?: string | null;
  reviewed?: boolean;
  /** Worker submitted a repair / fixed report (not merely "working OK"). */
  isFixedReport?: boolean;
  /** Set when admin marks broken equipment repaired, or on worker fixed reports. */
  fixedAt?: string | null;
  fixedBy?: string | null;
}

export interface SaleRecord {
  buyer: string;
  details: string;
  date: string;
  total: number;
  type: string;
  saleId?: string;
  quantityKg?: number;
  pricePerKg?: number;
  linkedBatchId?: string;
}

export interface ExpenseRecord {
  category: string;
  description: string;
  amount: number;
  date?: string | null;
  expenseId?: string;
  linkedEquipmentName?: string;
}

export type PayrollPaymentMethod = 'cash' | 'bank' | 'e-money';

export interface PayrollRecord {
  workerName: string;
  period: string;
  amount: number;
  paid: boolean;
  date?: string | null;
  workerId?: string;
  receiptNumber?: string;
  dailyRate?: number;
  daysWorked?: number;
  hourlyRate?: number;
  hoursWorked?: number;
  linkedAttendanceId?: string;
  paymentMethod?: PayrollPaymentMethod | null;
}

export interface CoffeeFieldRecord {
  fieldId?: string;
  name: string;
  area: string;
  trees: number;
  status: string;
  variety: string;
  age: string;
  nextHarvest: string;
  productivity: number;
}

export interface IrrigationSystemRecord {
  irrigationId?: string;
  zone: string;
  type: string;
  status: string;
  coverage: string;
  efficiency: number;
  lastMaintenance: string;
}

export interface IrrigationDamageReportRecord {
  reportId?: string;
  irrigationId?: string;
  zone?: string;
  sprinklerLabel: string;
  details: string;
  reportedAt: string;
  reportedBy: string;
  reportedByAuthUid?: string;
  status?: string;
}

export interface PestControlRecord {
  pestControlId?: string;
  date: string;
  field: string;
  issue: string;
  treatment: string;
  status: string;
  treeNumber?: string;
  photoUrl?: string;
}

export interface ConsumableSupplyRecord {
  supplyId: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  status: string;
  lastRestocked: string;
}

export interface ConsumableSupplyReportRecord {
  reportId?: string;
  supplyId?: string;
  supplyName: string;
  isRunOut: boolean;
  notes?: string;
  reportedAt: string;
  reportedBy: string;
  reportedByAuthUid?: string;
  reviewed?: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface AppState {
  workers: WorkerRecord[];
  attendance: AttendanceRecord[];
  tasks: TaskRecord[];
  sections: SectionRecord[];
  farmBlocks?: SectionRecord[];
  trees: TreeRecord[];
  treeRipenessScans: TreeRipenessScanRecord[];
  harvestSchedules: HarvestScheduleRecord[];
  harvestReadinessReports: HarvestReadinessReportRecord[];
  flowering: FloweringRecord[];
  cherryHarvests: CherryHarvestRecord[];
  batches: BatchRecord[];
  cherryGrades: CherryGradeRecord[];
  equipment: EquipmentRecord[];
  usageLogs: UsageLogRecord[];
  maintenanceLogs: MaintenanceRecord[];
  equipmentReports: EquipmentConditionReport[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  payroll: PayrollRecord[];
  coffeeFields: CoffeeFieldRecord[];
  irrigationSystems: IrrigationSystemRecord[];
  irrigationDamageReports: IrrigationDamageReportRecord[];
  pestControlLogs: PestControlRecord[];
  consumableSupplies: ConsumableSupplyRecord[];
  consumableReports: ConsumableSupplyReportRecord[];
}

export const defaultConsumableSupplies = (): ConsumableSupplyRecord[] => [
  { supplyId: 'C-1', name: 'Organic NPK 14-14-14', category: 'Fertilizer', stock: 45, unit: 'bags', status: 'In Stock', lastRestocked: '2026-05-18' },
  { supplyId: 'C-2', name: 'Neem Oil Insecticide', category: 'Pesticides', stock: 12, unit: 'liters', status: 'Low Stock', lastRestocked: '2026-05-20' },
  { supplyId: 'C-3', name: 'Soil booster Foliar spray', category: 'Vitamins', stock: 28, unit: 'bottles', status: 'In Stock', lastRestocked: '2026-05-22' },
  { supplyId: 'C-4', name: 'Ammonium Sulfate Nitrogen', category: 'Fertilizer', stock: 4, unit: 'bags', status: 'Low Stock', lastRestocked: '2026-05-12' },
  { supplyId: 'C-5', name: 'Root Growth Multi-Vitamins', category: 'Vitamins', stock: 0, unit: 'boxes', status: 'Out of Stock', lastRestocked: '2026-04-30' },
];

export const emptyAppState = (): AppState => ({
  workers: [],
  attendance: [],
  tasks: [],
  sections: [],
  trees: [],
  treeRipenessScans: [],
  harvestSchedules: [],
  harvestReadinessReports: [],
  flowering: [],
  cherryHarvests: [],
  batches: [],
  cherryGrades: [],
  equipment: [],
  usageLogs: [],
  maintenanceLogs: [],
  equipmentReports: [],
  sales: [],
  expenses: [],
  payroll: [],
  coffeeFields: [],
  irrigationSystems: [],
  irrigationDamageReports: [],
  pestControlLogs: [],
  consumableSupplies: [],
  consumableReports: [],
});

export function normalizeAppState(raw: Partial<AppState> | null | undefined): AppState {
  const base = emptyAppState();
  if (!raw) return base;
  const sections = raw.sections ?? raw.farmBlocks ?? [];
  return {
    ...base,
    ...raw,
    sections,
    workers: raw.workers ?? base.workers,
    attendance: raw.attendance ?? base.attendance,
    tasks: raw.tasks ?? base.tasks,
    trees: raw.trees ?? base.trees,
    treeRipenessScans: raw.treeRipenessScans ?? base.treeRipenessScans,
    harvestSchedules: raw.harvestSchedules ?? base.harvestSchedules,
    harvestReadinessReports: (raw.harvestReadinessReports ?? base.harvestReadinessReports).map((r, index) => ({
      reportId: r.reportId ?? `HR-${index + 1}`,
      zone: r.zone ?? '',
      expectedWeight: r.expectedWeight ?? '',
      reportedBy: r.reportedBy ?? '',
      reportedAt: r.reportedAt ?? '',
      status: r.status ?? 'Pending Review',
      notes: r.notes ?? '',
      reviewedAt: r.reviewedAt ?? '',
      reviewedBy: r.reviewedBy ?? '',
    })),
    flowering: raw.flowering ?? base.flowering,
    cherryHarvests: raw.cherryHarvests ?? base.cherryHarvests,
    batches: raw.batches ?? base.batches,
    cherryGrades: raw.cherryGrades ?? base.cherryGrades,
    equipment: raw.equipment ?? base.equipment,
    usageLogs: raw.usageLogs ?? base.usageLogs,
    maintenanceLogs: raw.maintenanceLogs ?? base.maintenanceLogs,
    equipmentReports: (raw.equipmentReports ?? base.equipmentReports).map((r) => ({
      reportId: r.reportId ?? '',
      equipmentName: r.equipmentName ?? '',
      isWrecked: Boolean(r.isWrecked),
      notes: r.notes ?? '',
      reportedAt: r.reportedAt ?? '',
      reportedBy: r.reportedBy ?? null,
      reviewed: Boolean(r.reviewed),
      isFixedReport: Boolean(r.isFixedReport),
      fixedAt: r.fixedAt ?? null,
      fixedBy: r.fixedBy ?? null,
    })),
    sales: raw.sales ?? base.sales,
    expenses: raw.expenses ?? base.expenses,
    payroll: raw.payroll ?? base.payroll,
    coffeeFields: raw.coffeeFields ?? base.coffeeFields,
    irrigationSystems: raw.irrigationSystems ?? base.irrigationSystems,
    irrigationDamageReports: (raw.irrigationDamageReports ?? base.irrigationDamageReports).map((r) => ({
      reportId: r.reportId ?? '',
      irrigationId: r.irrigationId ?? '',
      zone: r.zone ?? '',
      sprinklerLabel: r.sprinklerLabel ?? '',
      details: r.details ?? '',
      reportedAt: r.reportedAt ?? '',
      reportedBy: r.reportedBy ?? '',
      reportedByAuthUid: r.reportedByAuthUid ?? '',
      status: r.status ?? 'Pending',
    })),
    pestControlLogs: raw.pestControlLogs ?? base.pestControlLogs,
    consumableSupplies:
      raw.consumableSupplies?.map((s) => ({
        supplyId: s.supplyId ?? crypto.randomUUID(),
        name: s.name ?? '',
        category: s.category ?? 'Other',
        stock: Math.max(0, Number(s.stock) || 0),
        unit: s.unit ?? 'units',
        status: s.status ?? 'In Stock',
        lastRestocked: s.lastRestocked ?? '',
      })) ?? defaultConsumableSupplies(),
    consumableReports: (raw.consumableReports ?? base.consumableReports).map((r) => ({
      reportId: r.reportId ?? '',
      supplyId: r.supplyId ?? '',
      supplyName: r.supplyName ?? '',
      isRunOut: Boolean(r.isRunOut),
      notes: r.notes ?? '',
      reportedAt: r.reportedAt ?? '',
      reportedBy: r.reportedBy ?? '',
      reportedByAuthUid: r.reportedByAuthUid ?? '',
      reviewed: Boolean(r.reviewed),
      reviewedAt: r.reviewedAt ?? '',
      reviewedBy: r.reviewedBy ?? '',
    })),
  };
}

export function totalItemCount(state: AppState): number {
  return (
    state.workers.length +
    state.attendance.length +
    state.tasks.length +
    state.sections.length +
    state.trees.length +
    state.harvestSchedules.length +
    state.flowering.length +
    state.cherryHarvests.length +
    state.batches.length +
    state.cherryGrades.length +
    state.treeRipenessScans.length +
    state.harvestReadinessReports.length +
    state.equipment.length +
    state.usageLogs.length +
    state.maintenanceLogs.length +
    state.equipmentReports.length +
    state.sales.length +
    state.expenses.length +
    state.payroll.length +
    state.coffeeFields.length +
    state.irrigationSystems.length +
    state.irrigationDamageReports.length +
    state.pestControlLogs.length +
    state.consumableSupplies.length +
    state.consumableReports.length
  );
}
