import { useMemo, useState } from 'react';
import { useFarmData } from '../store/FarmDataProvider';
import {
  Clock,
  MapPin,
  Calendar,
  Plus,
  Edit2,
  Map as MapIcon,
  ShoppingCart,
} from 'lucide-react';
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
import { LUZON_PROVINCES } from '../data/luzonAddressCatalog';
import { BATAAN_MAP_HUBS } from '../data/bataanProvinceMap';
import { BataanCoffeeLeafletMap } from './BataanCoffeeLeafletMap';
import { runSave, showSaveError } from '../lib/saveFeedback';
import { parseWorkerDetails } from '../lib/workerUi';
import {
  buyersFromSales,
  encodeBuyerSaleDetails,
  saleRecordFromBuyerForm,
  currentPayPeriodLabel,
} from '../lib/profitUi';
import { saleLineTotal, hourlyRateForWorkerRole, payrollLineAmount } from '../lib/farmFinance';
import type {
  AppState,
  AttendanceRecord,
  PayrollRecord,
  WorkerRecord,
} from '../types/appState';

type BuyerCategory = 'channel' | 'cafe' | 'custom';

interface Buyer {
  id: number;
  category: BuyerCategory;
  hubIndex?: number;
  osmNodeId?: number;
  name: string;
  location: string;
  totalPurchases: number;
  lastOrder: string;
  status: 'active' | 'inactive';
  role?: string;
  lat?: number;
  lng?: number;
  addressLine?: string;
  municipalityLabel?: string;
}

type BuyerEditForm = {
  name: string;
  location: string;
  totalPurchases: string;
  lastOrder: string;
  status: 'active' | 'inactive';
  role: string;
  lat: string;
  lng: string;
  addressLine: string;
};

type AddBuyerFormState = {
  name: string;
  province: string;
  municipality: string;
  barangay: string;
  street: string;
  role: string;
  totalPurchases: string;
  lastOrder: string;
  status: 'active' | 'inactive';
  lat: string;
  lng: string;
};

const BUYER_ADDRESS_SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-[#4a2c2a]/25 bg-white px-3 py-2 text-sm text-[#3e2723] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

function composeAddBuyerFullAddress(form: AddBuyerFormState): string {
  const street = form.street.trim();
  return `${street}, Barangay ${form.barangay.trim()}, ${form.municipality.trim()}, ${form.province.trim()}`;
}

function addBuyerAddressFieldsReady(form: AddBuyerFormState): boolean {
  return Boolean(
    form.province.trim() &&
      form.municipality.trim() &&
      form.barangay.trim() &&
      form.street.trim(),
  );
}

function dateLabel(d = new Date()): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function attendanceSortValue(attendance: AttendanceRecord): number {
  const parsed = Date.parse(`${attendance.date || ''}T${attendance.clockIn || '00:00'}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatClock24h(raw?: string): string {
  const value = raw?.trim();
  if (!value) return '--:--';
  const match = value.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return value;
  const lowered = value.toLowerCase();
  const isPm = lowered.toLowerCase().includes('pm');
  const isAm = lowered.toLowerCase().includes('am');
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (isPm && hour >= 1 && hour <= 11) hour += 12;
  if (isAm && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return value;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function workerForAttendance(workers: WorkerRecord[], attendance: AttendanceRecord): WorkerRecord | undefined {
  const name = attendance.workerName.trim().toLowerCase();
  return workers.find((worker) => worker.name.trim().toLowerCase() === name);
}

function attendancePeriodLabel(attendance: AttendanceRecord): string {
  if (!attendance.date) return 'Attendance';
  const parsed = Date.parse(attendance.date);
  if (!Number.isFinite(parsed)) return attendance.date;
  return new Date(parsed).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function payrollFromAttendance(attendance: AttendanceRecord, worker?: WorkerRecord): PayrollRecord {
  const hourlyRate = hourlyRateForWorkerRole(worker?.roleRate ?? '');
  const hoursWorked = attendance.hoursWorked ?? 0;
  const record: PayrollRecord = {
    workerName: attendance.workerName,
    period: attendancePeriodLabel(attendance),
    amount: hourlyRate > 0 && hoursWorked > 0 ? Math.round(hourlyRate * hoursWorked) : 0,
    paid: false,
    date: attendance.date ?? new Date().toISOString().slice(0, 10),
    workerId: worker?.workerId ?? '',
    hourlyRate,
    hoursWorked,
    daysWorked: 0,
    dailyRate: 0,
    linkedAttendanceId: attendance.attendanceId ?? '',
    paymentMethod: null,
  };
  return { ...record, amount: payrollLineAmount(record) };
}

function getWorkerActivitiesForDate(state: AppState, workerName: string, date: string): string[] {
  const activities: string[] = [];
  const nameLower = workerName.trim().toLowerCase();

  // 1. Cherry harvests (pickerWorkerName matches workerName, and date matches)
  const harvests = state.cherryHarvests.filter((h) => {
    const hName = (h.pickerWorkerName || '').trim().toLowerCase();
    const hDate = h.date || '';
    return hName === nameLower && hDate.includes(date);
  });
  if (harvests.length > 0) {
    harvests.forEach((h) => {
      activities.push(`Harvested cherry batch ${h.batchId} (${h.weightText || 'unknown weight'})`);
    });
  }

  // 2. Cherry grades scanned (scannedByWorkerName matches workerName, date from savedAtMillis matches)
  const grades = state.cherryGrades.filter((g) => {
    const gName = (g.scannedByWorkerName || '').trim().toLowerCase();
    if (gName !== nameLower || !g.savedAtMillis) return false;
    const gDate = new Date(g.savedAtMillis).toISOString().slice(0, 10);
    return gDate === date;
  });
  if (grades.length > 0) {
    activities.push(`Scanned and graded ${grades.length} cherry batch${grades.length > 1 ? 'es' : ''}`);
  }

  // 3. Equipment reports reported by matches workerName, and date matches
  const eqReports = state.equipmentReports.filter((r) => {
    const rName = (r.reportedBy || '').trim().toLowerCase();
    const rDate = r.reportedAt || '';
    return rName === nameLower && rDate === date;
  });
  if (eqReports.length > 0) {
    eqReports.forEach((r) => {
      const condition = r.isFixedReport ? 'fixed' : (r.isWrecked ? 'wrecked' : 'OK');
      activities.push(`Reported equipment ${r.equipmentName} condition as ${condition} (${r.notes || 'no notes'})`);
    });
  }

  return activities;
}

export function MaintenanceManagement() {
  const { state, loading, updateState, saving } = useFarmData();
  const currentPeriod = currentPayPeriodLabel();

  // 1. Attendance variables
  const linkedAttendanceIds = useMemo(
    () =>
      new Set(
        state.payroll
          .map((payroll) => payroll.linkedAttendanceId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    [state.payroll],
  );
  const recentAttendance = useMemo(
    () => [...state.attendance].sort((a, b) => attendanceSortValue(b) - attendanceSortValue(a)).slice(0, 8),
    [state.attendance],
  );
  const pendingAttendance = state.attendance.filter(
    (attendance) =>
      attendance.awaitingPayrollLine &&
      Boolean(attendance.attendanceId?.trim()) &&
      !linkedAttendanceIds.has(attendance.attendanceId!.trim()),
  );

  // 2. Buyers & Map variables
  const buyers = useMemo(() => buyersFromSales(state.sales) as Buyer[], [state.sales]);
  const buyersSortedForUi = useMemo(() => {
    const rank: Record<BuyerCategory, number> = { channel: 0, cafe: 1, custom: 2 };
    return [...buyers].sort((a, b) => {
      if (rank[a.category] !== rank[b.category]) return rank[a.category] - rank[b.category];
      if (a.category === 'channel' && b.category === 'channel') return (a.hubIndex ?? 0) - (b.hubIndex ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [buyers]);

  const hubVolumesForMap = useMemo(
    () =>
      BATAAN_MAP_HUBS.map((hub, idx) => {
        const row = buyers.find((b) => b.category === 'channel' && b.hubIndex === idx);
        if (row) return row.totalPurchases;
        const byName = buyers.find((b) => b.name === hub.name || b.name.includes(hub.municipality) || hub.name.includes(b.name));
        return byName?.totalPurchases ?? 0;
      }),
    [buyers],
  );

  const hubStatusesForMap = useMemo(
    () =>
      BATAAN_MAP_HUBS.map((_, idx) => {
        const row = buyers.find((b) => b.category === 'channel' && b.hubIndex === idx);
        return { status: row?.status ?? 'active' };
      }),
    [buyers]
  );

  const hubDisplayNamesForMap = useMemo(
    () =>
      BATAAN_MAP_HUBS.map((h, idx) => {
        const row = buyers.find((b) => b.category === 'channel' && b.hubIndex === idx);
        return row?.name ?? h.name;
      }),
    [buyers]
  );

  const cafeMarkersForMap = useMemo(
    () =>
      buyers
        .filter((b): b is Buyer & { osmNodeId: number; lat: number; lng: number } =>
          b.category === 'cafe' && b.osmNodeId != null && b.lat != null && b.lng != null
        )
        .map((b) => ({
          osmNodeId: b.osmNodeId,
          lat: b.lat,
          lng: b.lng,
          name: b.name,
          municipality: b.municipalityLabel ?? 'Bataan',
          addressLine: b.addressLine,
          salesVolumePeso: b.totalPurchases,
          status: b.status,
        })),
    [buyers]
  );

  const customMarkersForMap = useMemo(
    () =>
      buyers
        .filter((b): b is Buyer & { lat: number; lng: number } =>
          b.category === 'custom' && b.lat != null && b.lng != null
        )
        .map((b) => ({
          id: b.id,
          lat: b.lat,
          lng: b.lng,
          name: b.name,
          salesVolumePeso: b.totalPurchases,
          status: b.status,
        })),
    [buyers]
  );

  // 3. Buyer Forms & Dialog states
  const [addBuyerOpen, setAddBuyerOpen] = useState(false);
  const [editBuyerId, setEditBuyerId] = useState<number | null>(null);
  const [buyerEditForm, setBuyerEditForm] = useState<BuyerEditForm>({
    name: '',
    location: '',
    totalPurchases: '',
    lastOrder: '',
    status: 'active',
    role: '',
    lat: '',
    lng: '',
    addressLine: '',
  });
  const [addBuyerForm, setAddBuyerForm] = useState<AddBuyerFormState>({
    name: '',
    province: '',
    municipality: '',
    barangay: '',
    street: '',
    role: 'Wholesale / depot buyer',
    totalPurchases: '',
    lastOrder: dateLabel(),
    status: 'active',
    lat: '',
    lng: '',
  });

  const openBuyerEdit = (buyer: Buyer) => {
    setEditBuyerId(buyer.id);
    setBuyerEditForm({
      name: buyer.name,
      location: buyer.location,
      totalPurchases: String(buyer.totalPurchases),
      lastOrder: buyer.lastOrder,
      status: buyer.status,
      role: buyer.role ?? '',
      lat: buyer.lat != null ? String(buyer.lat) : '',
      lng: buyer.lng != null ? String(buyer.lng) : '',
      addressLine: buyer.addressLine ?? '',
    });
  };

  const saveBuyerEdit = async () => {
    if (editBuyerId === null) return;
    const existing = buyers.find((b) => b.id === editBuyerId);
    if (!existing) return;
    const nameTrim = buyerEditForm.name.trim();
    if (!nameTrim) {
      showSaveError('Buyer name is required.');
      return;
    }
    const amount = Math.max(0, Math.round(Number.parseFloat(buyerEditForm.totalPurchases.replace(/,/g, '')) || 0));
    const location = buyerEditForm.location.trim() || existing.location;
    const lastOrder = buyerEditForm.lastOrder.trim() || existing.lastOrder;
    const lat = buyerEditForm.lat.trim() ? Number.parseFloat(buyerEditForm.lat) : undefined;
    const lng = buyerEditForm.lng.trim() ? Number.parseFloat(buyerEditForm.lng) : undefined;
    const detailsPayload = encodeBuyerSaleDetails({
      location,
      status: buyerEditForm.status,
      addressLine: buyerEditForm.addressLine.trim() || undefined,
      lat: lat != null && !Number.isNaN(lat) ? lat : undefined,
      lng: lng != null && !Number.isNaN(lng) ? lng : undefined,
      role: buyerEditForm.role.trim() || undefined,
      category: existing.category,
      hubIndex: existing.hubIndex,
      osmNodeId: existing.osmNodeId,
      municipalityLabel: existing.municipalityLabel,
    });

    const ok = await runSave('Buyer', () =>
      updateState((prev) => {
        let nextSales = prev.sales.map((s) => {
          if (s.buyer !== existing.name) return s;
          return {
            ...s,
            buyer: nameTrim,
            details: detailsPayload,
            date: lastOrder,
          };
        });
        const currentTotal = nextSales
          .filter((s) => s.buyer === nameTrim)
          .reduce((sum, s) => sum + saleLineTotal(s), 0);
        if (amount > 0 && amount !== currentTotal) {
          nextSales = [
            ...nextSales,
            saleRecordFromBuyerForm(nameTrim, detailsPayload, lastOrder, amount - currentTotal),
          ];
        }
        return { ...prev, sales: nextSales };
      }),
    );
    if (ok) setEditBuyerId(null);
  };

  const setupBataanChannel = async (hubIndex: number) => {
    const hub = BATAAN_MAP_HUBS[hubIndex];
    if (!hub) return;
    const channelName = hub.name;
    const detailsPayload = encodeBuyerSaleDetails({
      location: `${hub.municipality}, Bataan`,
      status: 'active',
      addressLine: `${channelName}, ${hub.municipality}, Bataan`,
      lat: hub.lat,
      lng: hub.lng,
      role: hub.role,
      category: 'channel',
      hubIndex,
      municipalityLabel: hub.municipality,
    });
    await runSave('Bataan channel', () =>
      updateState((prev) => {
        const alreadyExists = buyersFromSales(prev.sales).some(
          (buyer) => buyer.category === 'channel' && buyer.hubIndex === hubIndex,
        );
        if (alreadyExists) return prev;
        return {
          ...prev,
          sales: [
            ...prev.sales,
            saleRecordFromBuyerForm(channelName, detailsPayload, dateLabel(), 0),
          ],
        };
      }),
    );
  };

  const saveNewBuyer = async () => {
    const nameTrim = addBuyerForm.name.trim();
    if (!nameTrim || !addBuyerAddressFieldsReady(addBuyerForm)) {
      showSaveError('Fill in buyer name and full address (province, city, barangay, street).');
      return;
    }
    const locationLabel = `${addBuyerForm.municipality.trim()}, ${addBuyerForm.province.trim()}`;
    const fullAddress = composeAddBuyerFullAddress(addBuyerForm);
    const amount = Math.max(0, Math.round(Number.parseFloat(addBuyerForm.totalPurchases.replace(/,/g, '')) || 0));
    const lastOrder = addBuyerForm.lastOrder.trim() || dateLabel();
    const lat = addBuyerForm.lat.trim() ? Number.parseFloat(addBuyerForm.lat) : undefined;
    const lng = addBuyerForm.lng.trim() ? Number.parseFloat(addBuyerForm.lng) : undefined;
    const detailsPayload = encodeBuyerSaleDetails({
      location: locationLabel,
      status: addBuyerForm.status,
      addressLine: fullAddress || undefined,
      lat: lat != null && !Number.isNaN(lat) ? lat : undefined,
      lng: lng != null && !Number.isNaN(lng) ? lng : undefined,
      role: addBuyerForm.role.trim() || undefined,
      category: 'custom',
    });
    const ok = await runSave('Buyer', () =>
      updateState((prev) => ({
        ...prev,
        sales: [
          ...prev.sales,
          saleRecordFromBuyerForm(nameTrim, detailsPayload, lastOrder, amount > 0 ? amount : 0),
        ],
      })),
    );
    if (!ok) return;
    setAddBuyerForm({
      name: '',
      province: '',
      municipality: '',
      barangay: '',
      street: '',
      role: 'Wholesale / depot buyer',
      totalPurchases: '',
      lastOrder: dateLabel(),
      status: 'active',
      lat: '',
      lng: '',
    });
    setAddBuyerOpen(false);
  };

  // 4. Attendance Actions
  const createPayrollFromAttendance = async (attendance: AttendanceRecord) => {
    const attendanceId = attendance.attendanceId?.trim();
    if (!attendanceId || linkedAttendanceIds.has(attendanceId)) return;
    const worker = workerForAttendance(state.workers, attendance);
    const payroll = payrollFromAttendance(attendance, worker);
    const ok = await runSave('Attendance payroll', () =>
      updateState((prev) => ({
        ...prev,
        attendance: prev.attendance.map((row) =>
          row.attendanceId?.trim() === attendanceId
            ? { ...row, awaitingPayrollLine: false }
            : row
        ),
        payroll: [...prev.payroll, payroll],
      }))
    );
    if (!ok) showSaveError('Attendance payroll');
  };

  const clearAttendanceHistory = async () => {
    if (state.attendance.length === 0) return;
    await runSave('Attendance history', () =>
      updateState((prev) => ({
        ...prev,
        attendance: [],
      }))
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1>Maintenance Module</h1>
        <p className="text-muted-foreground">Loading maintenance data from Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Maintenance Module</h1>
          <p className="text-muted-foreground">Worker attendance logs, Bataan operations map, and buyer channels</p>
        </div>
        <Button
          onClick={() => setAddBuyerOpen(true)}
          className="bg-[#2d5016] hover:bg-[#234010] text-white flex items-center gap-1.5"
        >
          <Plus className="w-4.5 h-4.5" />
          Add buyer / channel
        </Button>
      </div>

      {/* Edit Buyer Dialog */}
      <Dialog open={editBuyerId !== null} onOpenChange={(open) => { if (!open) setEditBuyerId(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md border-[#4a2c2a]/15 bg-[#fdfbf7]">
          <DialogHeader>
            <DialogTitle className="text-[#3e2723]">Edit buyer / channel</DialogTitle>
            <DialogDescription>
              Changes are saved to Firebase and propagate to Luzon-wide maps and channels.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="buyer-name">Display name *</Label>
              <Input
                id="buyer-name"
                value={buyerEditForm.name}
                onChange={(e) => setBuyerEditForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-location">Short Location label (city, province) *</Label>
              <Input
                id="buyer-location"
                value={buyerEditForm.location}
                onChange={(e) => setBuyerEditForm((f) => ({ ...f, location: e.target.value }))}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-address">Full residential / delivery line</Label>
              <Input
                id="buyer-address"
                value={buyerEditForm.addressLine}
                onChange={(e) => setBuyerEditForm((f) => ({ ...f, addressLine: e.target.value }))}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-role">Role / description</Label>
              <Input
                id="buyer-role"
                value={buyerEditForm.role}
                onChange={(e) => setBuyerEditForm((f) => ({ ...f, role: e.target.value }))}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-volume">Illustrative purchases (₱)</Label>
              <Input
                id="buyer-volume"
                value={buyerEditForm.totalPurchases}
                onChange={(e) => setBuyerEditForm((f) => ({ ...f, totalPurchases: e.target.value }))}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyer-lat">Latitude (WGS84)</Label>
                <Input
                  id="buyer-lat"
                  value={buyerEditForm.lat}
                  onChange={(e) => setBuyerEditForm((f) => ({ ...f, lat: e.target.value }))}
                  placeholder="e.g., 14.62"
                  className="bg-white border-[#4a2c2a]/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-lng">Longitude (WGS84)</Label>
                <Input
                  id="buyer-lng"
                  value={buyerEditForm.lng}
                  onChange={(e) => setBuyerEditForm((f) => ({ ...f, lng: e.target.value }))}
                  placeholder="e.g., 120.54"
                  className="bg-white border-[#4a2c2a]/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-status">Status</Label>
              <select
                id="buyer-status"
                value={buyerEditForm.status}
                onChange={(e) => setBuyerEditForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                className="flex h-9 w-full rounded-md border border-[#4a2c2a]/25 bg-white px-3 py-2 text-sm text-[#3e2723] outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditBuyerId(null)} className="border-[#4a2c2a]/30">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveBuyerEdit()}
              disabled={saving || !buyerEditForm.name.trim()}
              className="bg-[#2d5016] hover:bg-[#234010] text-white"
            >
              Save buyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Buyer Dialog */}
      <Dialog open={addBuyerOpen} onOpenChange={setAddBuyerOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl border-[#4a2c2a]/15 bg-[#fdfbf7]">
          <DialogHeader>
            <DialogTitle className="text-[#3e2723]">Add buyer / channel</DialogTitle>
            <DialogDescription>
              Buyers can be anywhere in Luzon. Short location on lists is city, province; the full line is saved for reference.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-buyer-name">Display name *</Label>
              <Input
                id="add-buyer-name"
                value={addBuyerForm.name}
                onChange={(e) => setAddBuyerForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., QC roastery pickup"
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2 rounded-xl border border-[#4a2c2a]/15 bg-[#f5f1ed]/50 p-4">
              <p className="text-sm font-medium text-[#3e2723]">Buyer address · Luzon</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="add-buyer-province">Province *</Label>
                  <select
                    id="add-buyer-province"
                    value={addBuyerForm.province}
                    onChange={(e) =>
                      setAddBuyerForm((f) => ({
                        ...f,
                        province: e.target.value,
                        municipality: '',
                        barangay: '',
                        street: '',
                      }))
                    }
                    className={BUYER_ADDRESS_SELECT_CLASS}
                  >
                    <option value="">— Select province —</option>
                    {LUZON_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="add-buyer-city">City / municipality *</Label>
                  <Input
                    id="add-buyer-city"
                    value={addBuyerForm.municipality}
                    onChange={(e) =>
                      setAddBuyerForm((f) => ({
                        ...f,
                        municipality: e.target.value,
                        barangay: '',
                        street: '',
                      }))
                    }
                    placeholder="e.g., Baguio City, Limay, Makati"
                    className="bg-white border-[#4a2c2a]/20"
                    disabled={!addBuyerForm.province}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="add-buyer-barangay">Barangay *</Label>
                  <Input
                    id="add-buyer-barangay"
                    value={addBuyerForm.barangay}
                    onChange={(e) => setAddBuyerForm((f) => ({ ...f, barangay: e.target.value }))}
                    placeholder="e.g., Poblacion, San Jose"
                    className="bg-white border-[#4a2c2a]/20"
                    disabled={!addBuyerForm.municipality.trim()}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="add-buyer-street">Street *</Label>
                  <Input
                    id="add-buyer-street"
                    value={addBuyerForm.street}
                    onChange={(e) => setAddBuyerForm((f) => ({ ...f, street: e.target.value }))}
                    placeholder="e.g., Rizal Street, Session Road"
                    className="bg-white border-[#4a2c2a]/20"
                    disabled={!addBuyerForm.barangay.trim()}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-buyer-role">Role / notes</Label>
              <Input
                id="add-buyer-role"
                value={addBuyerForm.role}
                onChange={(e) => setAddBuyerForm((f) => ({ ...f, role: e.target.value }))}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-buyer-volume">Illustrative volume (₱)</Label>
              <Input
                id="add-buyer-volume"
                value={addBuyerForm.totalPurchases}
                onChange={(e) => setAddBuyerForm((f) => ({ ...f, totalPurchases: e.target.value }))}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-buyer-last">Last order (label)</Label>
              <Input
                id="add-buyer-last"
                value={addBuyerForm.lastOrder}
                onChange={(e) => setAddBuyerForm((f) => ({ ...f, lastOrder: e.target.value }))}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-buyer-status">Status</Label>
              <select
                id="add-buyer-status"
                value={addBuyerForm.status}
                onChange={(e) => setAddBuyerForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                className="flex h-9 w-full rounded-md border border-[#4a2c2a]/25 bg-white px-3 py-2 text-sm text-[#3e2723] outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-buyer-lat">Latitude (optional)</Label>
                <Input
                  id="add-buyer-lat"
                  value={addBuyerForm.lat}
                  onChange={(e) => setAddBuyerForm((f) => ({ ...f, lat: e.target.value }))}
                  placeholder="14.62"
                  className="bg-white border-[#4a2c2a]/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-buyer-lng">Longitude (optional)</Label>
                <Input
                  id="add-buyer-lng"
                  value={addBuyerForm.lng}
                  onChange={(e) => setAddBuyerForm((f) => ({ ...f, lng: e.target.value }))}
                  placeholder="120.54"
                  className="bg-white border-[#4a2c2a]/20"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddBuyerOpen(false)} className="border-[#4a2c2a]/30">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveNewBuyer()}
              disabled={saving || !addBuyerForm.name.trim() || !addBuyerAddressFieldsReady(addBuyerForm)}
              className="bg-[#2d5016] hover:bg-[#234010] text-white"
            >
              Add buyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. Worker Attendance Logs Block */}
      <div className="flex h-[620px] flex-col bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2d5016]/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#2d5016]" />
            </div>
            <div>
              <h3>Worker attendance logs</h3>
              <p className="text-sm text-muted-foreground">
                Clock-in records from the mobile app. Create payroll lines from pending attendance.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#f5f1ed] px-3 py-1 text-xs font-medium text-[#4a2c2a]">
              {pendingAttendance.length} pending payroll
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={saving || state.attendance.length === 0}
              onClick={() => void clearAttendanceHistory()}
            >
              Clear history
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent">
          {recentAttendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No worker attendance has synced yet.</p>
          ) : (
            <div className="space-y-3">
            {recentAttendance.map((attendance, index) => {
              const worker = workerForAttendance(state.workers, attendance);
              const isInactive = worker ? parseWorkerDetails(worker.details).status === 'inactive' : false;
              const attendanceId = attendance.attendanceId?.trim();
              const hasPayroll = Boolean(attendanceId && linkedAttendanceIds.has(attendanceId));
              const canCreatePayroll =
                Boolean(attendance.awaitingPayrollLine && attendanceId && !hasPayroll && (attendance.hoursWorked ?? 0) > 0);
              const previewPayroll = payrollFromAttendance(attendance, worker);
              return (
                <div
                  key={attendanceId || `${attendance.workerName}-${attendance.date}-${attendance.clockIn}-${index}`}
                  className="rounded-lg bg-[#f5f1ed] p-4 border border-[#4a2c2a]/10"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[#3e2723]">{attendance.workerName || 'Unnamed worker'}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-[#6b5d56]">
                          {worker?.roleRate || 'No role rate'}
                        </span>
                        {isInactive ? (
                          <span className="rounded-full bg-[#b0bec5] px-2.5 py-1 text-xs font-medium text-[#263238]">
                            Inactive
                          </span>
                        ) : null}
                        {hasPayroll ? (
                          <span className="rounded-full bg-[#2d5016] px-2.5 py-1 text-xs font-medium text-white">
                            Payroll line added
                          </span>
                        ) : attendance.awaitingPayrollLine ? (
                          <span className="rounded-full bg-[#d4a574]/30 px-2.5 py-1 text-xs font-medium text-[#4a2c2a]">
                            Awaiting payroll
                          </span>
                        ) : (
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs text-[#6b5d56]">
                            Recorded
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                        <span className="text-sm font-medium text-[#2d5016]">
                          Payroll: ₱{previewPayroll.amount.toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          className="bg-[#2d5016] text-white"
                          disabled={saving || !canCreatePayroll}
                          onClick={() => void createPayrollFromAttendance(attendance)}
                        >
                          Add payroll line
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-lg bg-white p-3 border border-[#4a2c2a]/10">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Date</p>
                        <p className="mt-1 text-sm font-semibold text-[#3e2723]">{attendance.date || 'No date'}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3 border border-[#4a2c2a]/10">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Time in</p>
                        <p className="mt-1 text-lg font-semibold text-[#2d5016]">{formatClock24h(attendance.clockIn)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3 border border-[#4a2c2a]/10">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Time out</p>
                        <p className="mt-1 text-lg font-semibold text-[#4a2c2a]">{formatClock24h(attendance.clockOut)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3 border border-[#4a2c2a]/10">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Hours</p>
                        <p className="mt-1 text-sm font-semibold text-[#3e2723]">
                          {(attendance.hoursWorked ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const dateStr = attendance.date || '';
                      const activities = getWorkerActivitiesForDate(state, attendance.workerName, dateStr);
                      return (
                        <div className="space-y-1.5 mt-1 border-t border-[#4a2c2a]/10 pt-2.5">
                          {attendance.details ? (
                            <p className="text-sm font-medium text-[#3e2723]">
                              Notes: <span className="font-normal text-[#6b5d56]">{attendance.details}</span>
                            </p>
                          ) : null}
                          {activities.length > 0 ? (
                            <div className="text-xs space-y-1">
                              <p className="font-semibold text-[#5d4037]">Activities / Tasks logged on this day:</p>
                              <ul className="list-disc list-inside text-[#6b5d56] space-y-0.5">
                                {activities.map((act, i) => (
                                  <li key={i}>{act}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-xs italic text-[#8b6f47]">No specific scans or equipment reports recorded for this day.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Bataan Operations Map & Channels Block */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#4a2c2a]/15 flex items-center justify-center">
            <MapIcon className="w-5 h-5 text-[#4a2c2a]" />
          </div>
          <div>
            <h3>Bataan operations map</h3>
            <p className="text-sm text-muted-foreground">Luzon bounds with interactive markers centered on Bataan hubs</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-sm font-medium text-[#3e2723]">Bataan — coffee on the map (zoom and pins)</h4>
            <BataanCoffeeLeafletMap
              hubStatuses={hubStatusesForMap}
              hubDisplayNames={hubDisplayNamesForMap}
              hubVolumes={hubVolumesForMap}
              cafeMarkers={cafeMarkersForMap}
              customBuyerMarkers={customMarkersForMap}
            />
          </div>

          <div className="space-y-3">
            <h4 className="font-medium mb-3">Channels in Bataan</h4>
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
              {BATAAN_MAP_HUBS.map((hub, idx) => {
                const channelBuyer = buyers.find((b) => b.category === 'channel' && b.hubIndex === idx);
                return (
                  <div key={`${hub.municipality}-${hub.name}`} className="bg-[#f5f1ed] rounded-lg p-3 border border-[#4a2c2a]/10">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: hub.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium">{channelBuyer?.name ?? hub.name}</h4>
                          {channelBuyer?.status === 'inactive' ? (
                            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Inactive
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{channelBuyer?.role ?? hub.role}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{channelBuyer?.location ?? `${hub.municipality}, Bataan`}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-[#4a2c2a]/10 gap-2">
                          <span className="text-muted-foreground">Synced channel volume</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-medium text-[#2d5016] tabular-nums">
                              ₱{(channelBuyer?.totalPurchases ?? 0).toLocaleString()}
                            </span>
                            {channelBuyer ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 border-[#4a2c2a]/25 text-[#3e2723]"
                                onClick={() => openBuyerEdit(channelBuyer)}
                              >
                                <Edit2 className="w-3.5 h-3.5 mr-1" />
                                Edit
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={saving}
                                className="h-7 px-2 border-[#4a2c2a]/25 text-[#3e2723]"
                                onClick={() => void setupBataanChannel(idx)}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Set up
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Buyers & Channels List Block */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
        <h3 className="mb-4">Buyers & channels list</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Channel hubs, OSM cafés (☕), and custom buyers you add. Edit any row to tune volumes; add Luzon-valid coordinates on custom buyers for an orange pin (map view stays on Bataan).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buyersSortedForUi.map((buyer) => (
            <div key={buyer.id} className="bg-[#f5f1ed] rounded-xl p-4 border border-[#4a2c2a]/10">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#4a2c2a] flex items-center justify-center shrink-0">
                    {buyer.category === 'cafe' ? (
                      <span className="text-sm text-white leading-none" aria-hidden>
                        ☕
                      </span>
                    ) : (
                      <ShoppingCart className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-sm truncate">{buyer.name}</h4>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white border border-[#4a2c2a]/15 text-muted-foreground shrink-0">
                        {buyer.category === 'channel' ? 'Channel hub' : buyer.category === 'cafe' ? 'Café (OSM)' : 'Other buyer'}
                      </span>
                    </div>
                    {buyer.role ? (
                      <p className="text-[11px] text-muted-foreground leading-snug mb-1">{buyer.role}</p>
                    ) : null}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{buyer.location}</span>
                    </div>
                    {buyer.addressLine ? (
                      <p className="text-[11px] text-muted-foreground leading-snug mt-1 pl-4">{buyer.addressLine}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      buyer.status === 'active' ? 'bg-[#2d5016] text-white' : 'bg-[#8b6f47] text-white'
                    }`}
                  >
                    {buyer.status}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 border-[#4a2c2a]/25 text-[#3e2723]"
                    onClick={() => openBuyerEdit(buyer)}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-[#4a2c2a]/10">
                <span className="text-muted-foreground">Total purchases</span>
                <span className="font-medium text-[#2d5016]">₱{buyer.totalPurchases.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Calendar className="w-3 h-3" />
                <span>Last order: {buyer.lastOrder}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
