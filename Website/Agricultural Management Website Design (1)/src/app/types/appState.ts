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

export interface SmsMessageRecord {
  messageId: string;
  senderName: string;
  senderRole?: string; // "Admin" | "Worker"
  senderPhone?: string;
  recipientName: string;
  recipientPhoneNumber?: string;
  recipientPhone?: string;
  messageBody: string;
  timestamp: number;
  sentViaCellularSms?: boolean;
  status?: string;
  viaGateway?: string;
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
  timeInLatitude?: number | null;
  timeInLongitude?: number | null;
  timeInLocationName?: string;
  faceSnapshotBase64?: string;
  isGeofenceVerified?: boolean | null;
  /** Independent biometric + location capture for the Time Out punch (never copied from Time In). */
  timeOutLatitude?: number | null;
  timeOutLongitude?: number | null;
  timeOutLocationName?: string;
  timeOutFaceSnapshotBase64?: string;
  isTimeOutGeofenceVerified?: boolean | null;
  timestampMillis?: number;
  /**
   * hoursWorked split against the standard shift (see STANDARD_SHIFT_HOURS in farmFinance.ts),
   * computed by the Android app when this record is created/updated from an actual clock punch.
   * Undefined on records saved before this field existed -- payroll built from those falls back
   * to the flat hourlyRate x hoursWorked calculation.
   */
  regularHours?: number | null;
  overtimeHours?: number | null;
}

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface TimesheetAuditEntry {
  actorName: string;
  action: string;
  remarks?: string;
  timestamp: string;
}

export interface TimesheetCorrectionRequest {
  correctionId: string;
  attendanceId?: string;
  workerName: string;
  date: string;
  field: 'clockIn' | 'clockOut' | 'both';
  originalClockIn?: string;
  originalClockOut?: string;
  requestedClockIn?: string;
  requestedClockOut?: string;
  reason: string;
  status: ApprovalStatus;
  submittedAt: string;
  submittedBy: string;
  /** Firebase auth uid of the worker who submitted this request; identifies which worker's private app_state/{uid} doc owns this record. */
  submittedByAuthUid?: string;
  /** Photo taken at submission time, proving the worker was present when filing this request. */
  faceSnapshotBase64?: string | null;
  /** GPS fix captured at submission time; null if location permission/GPS was unavailable. */
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  /** True only when latitude/longitude were captured and fell within the farm geofence. */
  isGeofenceVerified?: boolean | null;
  reviewedAt?: string;
  reviewedBy?: string;
  managerRemarks?: string;
  auditTrail: TimesheetAuditEntry[];
}

export interface LeaveRequestRecord {
  leaveId: string;
  workerName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  leaveDays: number;
  reason: string;
  status: ApprovalStatus;
  submittedAt: string;
  submittedBy: string;
  /** Firebase auth uid of the worker who submitted this request; identifies which worker's private app_state/{uid} doc owns this record. */
  submittedByAuthUid?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  managerRemarks?: string;
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
  /** Firebase auth uid of the worker who saved this scan; identifies which worker's private app_state/{uid} doc owns this record. */
  scannedByAuthUid?: string | null;
}

export interface HarvestScheduleRecord {
  sectionName: string;
  details: string;
  status: string;
  farmBlockName?: string;
}

export interface HarvestReadinessReportRecord {
  reportId: string;
  workerName?: string;
  section?: string;
  readinessStatus?: 'Ready for Harvest' | 'Not Ready for Harvest' | string;
  date?: string;
  time?: string;
  timestampMillis?: number;
  status: 'Pending Review' | 'Confirmed' | 'Rejected' | 'Approved' | string;
  // Backward compatibility fields
  zone?: string;
  expectedWeight?: string;
  reportedBy?: string;
  /** Firebase auth uid of the worker who submitted this report; identifies which worker's private app_state/{uid} doc owns this record. */
  reportedByAuthUid?: string;
  reportedAt?: string;
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
  /** Raw on-device CNN species read, kept even when `species` was overridden by the scan's field-declared variety. */
  cnnDetectedSpecies?: string | null;
  cnnSpeciesConfidence?: string | null;
  savedAtMillis?: number | null;
  treeId?: string | null;
  /** Farm section / sector / block / plot picked on the phone when the scan was saved. */
  location?: string | null;
  scannedByWorkerName?: string | null;
  scannedByEmail?: string | null;
  scannedByAuthUid?: string | null;
  /**
   * Per-cherry CNN detection counts for this scan. `grade` is only a single coarse branch-level
   * recommendation ("Optimal Harvest Ready" / "Selective Picking Recommended" / "Wait / Unripe")
   * derived from `ripeCount` -- it can never say "overripe", so accurate per-cherry ripe/unripe/
   * overripe dashboard totals need these counts directly. Undefined for scans saved before this
   * field existed (the Android app's `cherry_scans` Firestore collection has always captured this
   * breakdown, but it never reached `app_state/farm` until this field was added).
   */
  unripeCount?: number | null;
  ripeningCount?: number | null;
  ripeCount?: number | null;
  overripeCount?: number | null;
  dryDamagedCount?: number | null;
}

export interface EquipmentRecord {
  name: string;
  category: string;
  status: string;
  assignedTo: string | null;
  currentValue: number;
  /** How many of this equipment (matched by name + category) are stacked into this one record,
   * instead of creating a duplicate row each time the same item is added again. Defaults to 1
   * for existing records that predate this field. */
  quantity?: number;
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
  /** Firebase auth uid of the worker who submitted this report; identifies which worker's private app_state/{uid} doc owns this record. */
  reportedByAuthUid?: string;
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
  /** Set when this sale is linked to a registered Buyer account, so it counts toward that
   * buyer's totals on the admin Buyer Locations Map alongside their storefront orders. */
  buyerUid?: string;
  buyerEmail?: string;
  /** Unit `quantityKg`/`pricePerKg` are actually denominated in for this sale -- the field names
   * predate non-kg packaging (bag/sack), so kg-specific stats (totalKgSold, price/margin per kg)
   * must only include sales where this is 'kg' or unset (legacy rows, all originally kg-based). */
  unit?: 'kg' | 'bag' | 'sack' | string;
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
  /**
   * Carried over from the source AttendanceRecord when this line was generated from attendance.
   * When present, payrollLineAmount() pays overtimeHours at hourlyRate x OVERTIME_MULTIPLIER
   * instead of the flat rate. Undefined on older rows (or rows entered manually without a split),
   * which keep the flat hourlyRate x hoursWorked amount.
   */
  regularHours?: number | null;
  overtimeHours?: number | null;
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
  lat?: number;
  lng?: number;
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
  photoBase64?: string;
  reportedBy?: string;
  /** Firebase auth uid of the worker who submitted this log; identifies which worker's private app_state/{uid} doc owns this record. */
  reportedByAuthUid?: string;
  time?: string;
  notes?: string;
  timestampMillis?: number;
  reviewedAt?: string;
  reviewedBy?: string;
}

/**
 * A finished-product listing Admin puts up for sale on the Buyer storefront -- e.g. "Ripe
 * Arabica Cherries, 50kg available at ₱120/kg". Admin-managed only (see the Buyer role
 * design decision): the Buyer catalog shows exactly these listings, never an automatic
 * calculation from harvest records. Admin can optionally trace a listing back to the
 * `CherryHarvestRecord` (and the worker who picked it) it was made from -- for provenance
 * only, it never drives `availableQty`.
 */
export interface ProductListingRecord {
  listingId: string;
  name: string;
  category: string;
  unit: string;
  pricePerUnit: number;
  availableQty: number;
  status: string;
  imageUrl?: string;
  createdAt?: string;
  /** `CherryHarvestRecord.harvestId` (falls back to its `batchId`) this listing was sourced from. */
  sourceHarvestId?: string;
  /** Denormalized from the harvest record at link time so the storefront card doesn't need a join. */
  sourceHarvestWorkerName?: string;
  sourceHarvestWeightText?: string;
  sourceHarvestDate?: string;
}

export interface ConsumableSupplyRecord {
  supplyId: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  status: string;
  lastRestocked: string;
  referenceStock?: number;
  lowStockThreshold?: number;
  /** Price per unit (₱), e.g. per bag/liter/kg -- optional, set from the Add/Edit Supply form. */
  costPerUnit?: number;
}

export function computeLowStockThreshold(item: Partial<ConsumableSupplyRecord>): number {
  if (typeof item.lowStockThreshold === 'number' && item.lowStockThreshold >= 0) {
    return item.lowStockThreshold;
  }
  const ref = item.referenceStock && item.referenceStock > 0 ? item.referenceStock : (item.stock && item.stock > 0 ? item.stock : 30);
  return Math.ceil(ref * 0.3);
}

export function computeSupplyStatus(
  inputOrStock: number | Partial<ConsumableSupplyRecord>,
  referenceStock?: number,
  threshold?: number,
): string {
  if (typeof inputOrStock === 'object' && inputOrStock !== null) {
    const stock = inputOrStock.stock ?? 0;
    if (stock <= 0) return 'Out of Stock';
    const thresh = computeLowStockThreshold(inputOrStock);
    if (stock <= thresh) return 'Low Stock';
    return 'In Stock';
  }
  const stock = typeof inputOrStock === 'number' ? inputOrStock : 0;
  if (stock <= 0) return 'Out of Stock';
  const effectiveThreshold =
    threshold !== undefined
      ? threshold
      : Math.ceil((referenceStock || Math.max(stock, 30)) * 0.3);
  if (stock <= effectiveThreshold) return 'Low Stock';
  return 'In Stock';
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
  timesheetCorrections: TimesheetCorrectionRequest[];
  leaveRequests: LeaveRequestRecord[];
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
  smsMessages: SmsMessageRecord[];
  productListings: ProductListingRecord[];
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
  timesheetCorrections: [],
  leaveRequests: [],
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
  smsMessages: [],
  productListings: [],
});

/**
 * A single line item within a Buyer's order (a quantity of one ProductListingRecord at the
 * price it had when the order was placed).
 */
export interface BuyerOrderItem {
  listingId: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  quantity: number;
  subtotal: number;
}

/**
 * A Buyer-placed order, stored in its own top-level `buyer_orders` Firestore collection (see
 * COLLECTIONS.BUYER_ORDERS) rather than inside the app_state/farm blob, because a Buyer is only
 * ever allowed to create/read their own order docs -- never write shared farm state.
 * Inventory (ProductListingRecord.availableQty) only decrements when Admin marks an order
 * fulfilled, to avoid stock mismatches from cancelled orders. Meanwhile a pending order is
 * RESERVED through its `stock_holds/{orderId}` doc: buyers see stock minus holds, Admin deleting the
 * hold (on cancel or fulfil) is what releases it.
 */
export interface BuyerOrderRecord {
  orderId: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string;
  items: BuyerOrderItem[];
  totalAmount: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
  createdAt?: string;
  fulfilledAt?: string | null;
  /** How the buyer gets the order. Absent on orders placed before this option existed. */
  fulfillmentMethod?: BuyerFulfillmentMethod;
  /** Address the buyer typed at checkout for a delivery; null for pickup orders. */
  deliveryAddress?: string | null;
  buyerPhone?: string;
  /** Luzon province chosen for delivery (drives `deliveryFee`); null for pickup orders. */
  deliveryProvince?: string | null;
  /** Items total before the delivery fee. `totalAmount` = subtotal + deliveryFee (what the buyer pays). */
  subtotal?: number;
  deliveryFee?: number;
  paymentMethod?: BuyerPaymentMethod;
  /** Delivery Rider the admin assigned to a delivery order (copied from the worker record when assigned). */
  riderWorkerId?: string;
  riderName?: string;
  riderPhone?: string;
  riderAssignedAt?: string;
  /** Firebase uid of the rider's login (WorkerRecord.authUid): lets firestore.rules show the order to that rider only. */
  riderUid?: string;
  /** Map pin the buyer dropped for this delivery, so the rider's app can show the location. */
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  /** Set by the rider's app: 'assigned' -> 'out_for_delivery' -> 'delivered'. Admin's `status` (fulfilled) is separate. */
  deliveryStatus?: BuyerDeliveryStatus | null;
  deliveryUpdatedAt?: string | null;
  deliveredAt?: string | null;
  /** True once the rider has saved a proof-of-delivery photo (the photo itself is in `delivery_proofs/{orderId}`). */
  hasDeliveryProof?: boolean;
}

export type BuyerDeliveryStatus = 'assigned' | 'out_for_delivery' | 'delivered';

export type BuyerFulfillmentMethod = 'delivery' | 'pickup';

/** Cash means Cash on Delivery for a delivery order and cash at the farm for a pickup order. */
export type BuyerPaymentMethod = 'cash' | 'e_wallet';

/**
 * A single message in the direct Admin <-> Owner thread, stored in its own top-level
 * `owner_admin_messages` Firestore collection (see COLLECTIONS.OWNER_ADMIN_MESSAGES) rather
 * than inside the app_state/farm blob, for the same reason BuyerOrderRecord is: firestore.rules
 * blocks the read-only Owner role from writing app_state at all, so a message Owner sends to
 * Admin (or vice versa) needs a collection where both roles are allowed to create documents.
 * There is exactly one Admin and one Owner account in this system, so this is a single shared
 * thread -- no conversation/thread id needed.
 */
export interface OwnerAdminMessageRecord {
  messageId: string;
  senderUid: string;
  senderRole: 'ADMINISTRATOR' | 'OWNER';
  senderName: string;
  body: string;
  createdAt: string;
}

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
    timesheetCorrections: (raw.timesheetCorrections ?? base.timesheetCorrections).map((r) => ({
      correctionId: r.correctionId ?? '',
      attendanceId: r.attendanceId ?? '',
      workerName: r.workerName ?? '',
      date: r.date ?? '',
      field: r.field ?? 'both',
      originalClockIn: r.originalClockIn ?? '',
      originalClockOut: r.originalClockOut ?? '',
      requestedClockIn: r.requestedClockIn ?? '',
      requestedClockOut: r.requestedClockOut ?? '',
      reason: r.reason ?? '',
      status: r.status ?? 'Pending',
      submittedAt: r.submittedAt ?? '',
      submittedBy: r.submittedBy ?? '',
      submittedByAuthUid: r.submittedByAuthUid ?? '',
      faceSnapshotBase64: r.faceSnapshotBase64 ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      locationName: r.locationName ?? null,
      isGeofenceVerified: r.isGeofenceVerified ?? null,
      reviewedAt: r.reviewedAt ?? '',
      reviewedBy: r.reviewedBy ?? '',
      managerRemarks: r.managerRemarks ?? '',
      auditTrail: (r.auditTrail ?? []).map((entry) => ({
        actorName: entry.actorName ?? '',
        action: entry.action ?? '',
        remarks: entry.remarks ?? '',
        timestamp: entry.timestamp ?? '',
      })),
    })),
    leaveRequests: (raw.leaveRequests ?? base.leaveRequests).map((r) => ({
      leaveId: r.leaveId ?? '',
      workerName: r.workerName ?? '',
      leaveType: r.leaveType ?? 'Vacation Leave',
      startDate: r.startDate ?? '',
      endDate: r.endDate ?? '',
      leaveDays: Number(r.leaveDays) || 0,
      reason: r.reason ?? '',
      status: r.status ?? 'Pending',
      submittedAt: r.submittedAt ?? '',
      submittedBy: r.submittedBy ?? '',
      submittedByAuthUid: r.submittedByAuthUid ?? '',
      reviewedAt: r.reviewedAt ?? '',
      reviewedBy: r.reviewedBy ?? '',
      managerRemarks: r.managerRemarks ?? '',
    })),
    tasks: raw.tasks ?? base.tasks,
    trees: raw.trees ?? base.trees,
    treeRipenessScans: raw.treeRipenessScans ?? base.treeRipenessScans,
    harvestSchedules: raw.harvestSchedules ?? base.harvestSchedules,
    harvestReadinessReports: (raw.harvestReadinessReports ?? base.harvestReadinessReports).map((r, index) => {
      const section = r.section ?? r.zone ?? 'Section F';
      const workerName = r.workerName ?? r.reportedBy ?? 'Juan Dela Cruz';
      const readinessStatus = r.readinessStatus ?? (r.expectedWeight ? 'Ready for Harvest' : 'Ready for Harvest');
      const date = r.date ?? (r.reportedAt ? r.reportedAt.split('T')[0] : 'September 4, 2026');
      const time = r.time ?? '8:30 AM';
      const reportedAt = r.reportedAt ?? `${date} ${time}`;
      return {
        reportId: r.reportId || `HR-${index + 1}`,
        workerName,
        section,
        readinessStatus,
        date,
        time,
        timestampMillis: r.timestampMillis ?? (Date.parse(reportedAt) || Date.now() - index * 60000),
        status: r.status ?? 'Pending Review',
        // Backward compatibility
        zone: section,
        expectedWeight: r.expectedWeight ?? (readinessStatus === 'Ready for Harvest' ? 'Harvest Ready' : 'Maturing'),
        reportedBy: workerName,
        reportedByAuthUid: r.reportedByAuthUid ?? '',
        reportedAt,
        notes: r.notes ?? '',
        reviewedAt: r.reviewedAt ?? '',
        reviewedBy: r.reviewedBy ?? '',
      };
    }),
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
      reportedByAuthUid: r.reportedByAuthUid ?? '',
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
    pestControlLogs: (raw.pestControlLogs ?? base.pestControlLogs).map((p, index) => ({
      pestControlId: p.pestControlId || `PEST-${index + 1}`,
      date: p.date ?? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      time: p.time ?? '8:30 AM',
      field: p.field ?? 'Section F',
      issue: p.issue ?? 'Pest / Disease Observed',
      treatment: p.treatment ?? '',
      status: p.status ?? 'Pending',
      treeNumber: p.treeNumber ?? '',
      photoUrl: p.photoUrl ?? (p.photoBase64 ?? ''),
      photoBase64: p.photoBase64 ?? (p.photoUrl ?? ''),
      reportedBy: p.reportedBy ?? 'Juan Dela Cruz',
      reportedByAuthUid: p.reportedByAuthUid ?? '',
      notes: p.notes ?? '',
      timestampMillis: p.timestampMillis ?? (Date.parse(p.date || '') || Date.now() - index * 60000),
      reviewedAt: p.reviewedAt ?? '',
      reviewedBy: p.reviewedBy ?? '',
    })),
    consumableSupplies:
      raw.consumableSupplies?.map((s) => {
        const stock = Math.max(0, Number(s.stock) || 0);
        const referenceStock = typeof s.referenceStock === 'number' ? s.referenceStock : (stock > 0 ? Math.max(stock, 30) : 30);
        const lowStockThreshold = typeof s.lowStockThreshold === 'number' ? s.lowStockThreshold : Math.ceil(referenceStock * 0.3);
        const status = s.status || computeSupplyStatus(stock, referenceStock, lowStockThreshold);
        return {
          supplyId: s.supplyId ?? crypto.randomUUID(),
          name: s.name ?? '',
          category: s.category ?? 'Other',
          stock,
          unit: s.unit ?? 'units',
          status,
          lastRestocked: s.lastRestocked ?? '',
          referenceStock,
          lowStockThreshold,
          ...(typeof s.costPerUnit === 'number' ? { costPerUnit: s.costPerUnit } : {}),
        };
      }) ?? defaultConsumableSupplies(),
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
    smsMessages: (raw.smsMessages ?? base.smsMessages).map((m) => ({
      messageId: m.messageId ?? '',
      senderName: m.senderName ?? '',
      senderRole: m.senderRole ?? '',
      recipientName: m.recipientName ?? '',
      recipientPhoneNumber: m.recipientPhoneNumber ?? '',
      messageBody: m.messageBody ?? '',
      timestamp: Number(m.timestamp) || Date.now(),
      sentViaCellularSms: Boolean(m.sentViaCellularSms),
    })),
  };
}

/**
 * Worker-submitted record lists. Each of these is written to the owning worker's own
 * `app_state/{uid}` document instead of the shared `app_state/farm` document, so one worker's
 * submissions are never readable by another worker (see firestore.rules). Everything else in
 * [AppState] describes shared farm structure and is written to `app_state/farm`.
 */
export const PRIVATE_FIELD_KEYS = [
  'attendance',
  'timesheetCorrections',
  'leaveRequests',
  'treeRipenessScans',
  'cherryGrades',
  'harvestReadinessReports',
  'irrigationDamageReports',
  'equipmentReports',
  'pestControlLogs',
  'consumableReports',
] as const satisfies readonly (keyof AppState)[];

export type PrivateFieldKey = (typeof PRIVATE_FIELD_KEYS)[number];

const PRIVATE_FIELD_KEY_SET: ReadonlySet<string> = new Set(PRIVATE_FIELD_KEYS);

export const SHARED_FIELD_KEYS = (Object.keys(emptyAppState()) as (keyof AppState)[]).filter(
  (key) => !PRIVATE_FIELD_KEY_SET.has(key),
);

/** Returns a copy of `state` with every private field emptied, safe to write to `app_state/farm`. */
export function projectSharedFields(state: AppState): AppState {
  const result = { ...emptyAppState(), ...state };
  for (const key of PRIVATE_FIELD_KEYS) {
    (result[key] as unknown[]) = [];
  }
  return result;
}

/** Returns a copy of `state` with every shared field emptied, safe to write to `app_state/{uid}`. */
export function projectPrivateFields(state: AppState): AppState {
  const result = { ...emptyAppState(), ...state };
  for (const key of SHARED_FIELD_KEYS) {
    (result[key] as unknown[]) = [];
  }
  return result;
}

/**
 * Combines every worker's private slice (each read from that worker's own `app_state/{uid}`
 * document) into one aggregate view for the admin website. `sharedState` supplies every
 * non-private field untouched.
 */
export function mergeWorkerPrivateStates(
  sharedState: AppState,
  privateStatesByUid: Record<string, AppState>,
): AppState {
  const result = { ...sharedState };
  for (const key of PRIVATE_FIELD_KEYS) {
    (result[key] as unknown[]) = Object.values(privateStatesByUid).flatMap(
      (s) => (s[key] as unknown[]) ?? [],
    );
  }
  return result;
}

export function totalItemCount(state: AppState): number {
  return (
    state.workers.length +
    state.attendance.length +
    state.timesheetCorrections.length +
    state.leaveRequests.length +
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
    state.consumableReports.length +
    state.smsMessages.length
  );
}
