import type { EquipmentConditionReport } from '../types/appState';

export function isEquipmentFixedReport(report: EquipmentConditionReport): boolean {
  return Boolean(report.isFixedReport || report.fixedAt);
}

export function equipmentReportConditionLabel(report: EquipmentConditionReport): string {
  if (report.fixedAt || report.isFixedReport) return 'Fixed / repaired';
  if (report.isWrecked) return 'Wrecked / broken';
  return 'Working OK';
}

export function equipmentReportBadgeClass(report: EquipmentConditionReport): string {
  if (isEquipmentFixedReport(report)) return 'bg-[#2d5016] text-white';
  if (report.isWrecked) return 'bg-[#d4183d] text-white';
  return 'bg-[#4a2c2a]/15 text-[#4a2c2a]';
}
