/** Shared Recharts styling and formatters for farm dashboards. */

import type { CSSProperties } from 'react';

export const CHART_MARGIN = { top: 12, right: 20, left: 4, bottom: 8 };

export const CHART_MARGIN_WITH_BOTTOM_LABELS = { top: 12, right: 20, left: 4, bottom: 48 };

/** High-contrast series colors (readable on cream/white chart backgrounds). */
export const CHART_COLORS = {
  primary: '#2d5016',
  secondary: '#8b6f47',
  accent: '#c68a4c',
  tertiary: '#4a2c2a',
  muted: '#a0826d',
  danger: '#d4183d',
  harvest: '#2d5016',
  grid: 'rgba(74, 44, 42, 0.08)',
  axis: '#6b5d56',
} as const;

export const CHART_AXIS_TICK = { fill: CHART_COLORS.axis, fontSize: 11, fontWeight: 500 };

/** Angled month labels so two or more ticks stay readable (no "…" clipping). */
export const CHART_AXIS_TICK_ANGLED = {
  ...CHART_AXIS_TICK,
  angle: -32,
  textAnchor: 'end' as const,
};

export const CHART_LINE_WIDTH = 2.5;

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.92)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(74, 44, 42, 0.08)',
  borderRadius: 12,
  boxShadow: '0 8px 30px rgba(74, 44, 42, 0.08)',
  fontSize: 12,
  padding: '8px 12px',
};

/** Distinct categorical palette for pie / donut charts. */
export const PIE_COLORS = [
  '#2d5016', // Forest green
  '#4a2c2a', // Deep espresso
  '#8b6f47', // Warm coffee brown
  '#d4a574', // Coffee light brown
  '#a0826d', // Medium earthy brown
  '#e8d5c4', // Light cream accent
  '#5c3e3c', // Medium espresso
  '#a88c74', // Clay brown
  '#6b705c', // Olive green
] as const;

export const CHART_LINE_SERIES = {
  revenue: '#2d5016',    // Green (income)
  expenses: '#c2410c',   // Terracotta/warm rust (expenses)
  profit: '#4a2c2a',     // Deep espresso brown (net profit)
  sales: '#2d5016',      // Green (sales)
} as const;

export const CHART_CHERRY = {
  ripe: '#dc2626',       // Cherry Red (botanically correct!)
  nearRipe: '#eab308',   // Yellow/Orange
  unripe: '#16a34a',     // Fresh Unripe Green
  overripe: '#581c87',   // Deep Dark Purple
} as const;

export type CherryGradeBucket = 'ripe' | 'nearRipe' | 'unripe' | 'overripe' | 'unknown';

const CHERRY_BUCKET_LABELS: Record<CherryGradeBucket, string> = {
  ripe: 'Ripe',
  nearRipe: 'Near ripe',
  unripe: 'Unripe',
  overripe: 'Overripe',
  unknown: 'Unknown',
};

/** Map CNN / mobile grade strings into chart buckets (matches CherryGradeTfliteClassifier labels). */
export function cherryGradeBucket(grade: string | null | undefined): CherryGradeBucket {
  const k = (grade ?? '').toLowerCase().trim();
  if (!k || k === 'unknown' || k.includes('uncertain')) return 'unknown';
  if (k.includes('overripe') || k.includes('over-ripe') || k.includes('defect')) return 'overripe';
  if (k.includes('semi') || k.includes('near') || k.includes('yellow')) return 'nearRipe';
  if (k.includes('unripe') || k.includes('green')) return 'unripe';
  if (k.includes('red') || k === 'ripe' || (k.includes('ripe') && !k.includes('un'))) return 'ripe';
  return 'unknown';
}

export function cherryBucketLabel(bucket: CherryGradeBucket): string {
  return CHERRY_BUCKET_LABELS[bucket];
}

export const CHART_EQUIPMENT_STATUS = {
  available: '#16A34A',
  'in-use': '#2563EB',
  maintenance: '#EAB308',
  damaged: '#DC2626',
} as const;

export const CHART_QUALITY = {
  excellent: '#16A34A',
  good: '#2563EB',
  fair: '#F97316',
} as const;

/** Only hide the chart when there is no series to plot at all. */
export function chartSeriesEmpty(data: unknown[]): boolean {
  return data.length === 0;
}

/** Pie/donut charts: hide when every slice is zero (placeholder rows still have length > 0). */
export function chartPieHasData(data: { value?: number }[]): boolean {
  return data.some((row) => (row.value ?? 0) > 0);
}

/** Line/bar charts: true when at least one numeric series has a non-zero value. */
export function chartMonetarySeriesHasData(
  data: Record<string, unknown>[],
  keys: string[],
): boolean {
  if (data.length === 0) return false;
  return data.some((row) =>
    keys.some((key) => {
      const v = Number(row[key]);
      return Number.isFinite(v) && Math.abs(v) > 0;
    }),
  );
}

const MONTH_NAME_TO_NUM: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Current calendar month as `YYYY-MM` (for undated maintenance rows). */
export function currentMonthSortKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Sortable `YYYY-MM` key for chart buckets; `null` when the date is missing or invalid. */
export function monthSortKeyFromDate(date: string | null | undefined): string | null {
  const raw = (date ?? '').trim();
  if (!raw || raw === '—') return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    if (y >= 1970 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  const slash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    let y = Number(slash[3]);
    if (y < 100) y += 2000;
    let month = a;
    let day = b;
    if (a > 12 && b <= 12) {
      month = b;
      day = a;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}`;
    }
  }

  const monthWord = raw.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b[\s,./-]*['']?(\d{2,4})?/i,
  );
  if (monthWord) {
    const token = monthWord[1]!.slice(0, 3).toLowerCase();
    const month = MONTH_NAME_TO_NUM[token];
    if (month) {
      let y = new Date().getFullYear();
      if (monthWord[2]) {
        const yr = Number(monthWord[2]);
        y = yr < 100 ? 2000 + yr : yr;
      }
      return `${y}-${String(month).padStart(2, '0')}`;
    }
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (y >= 1970 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  return null;
}

/** Display label for a `YYYY-MM` sort key. */
export function monthLabelFromSortKey(sortKey: string): string {
  const [y, m] = sortKey.split('-');
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return sortKey;
  }
  return new Date(year, month - 1, 1).toLocaleDateString('en-PH', {
    month: 'short',
    year: 'numeric',
  });
}

/** Normalize assorted date strings into a short month label for chart buckets. */
export function monthLabelFromDate(date: string | null | undefined): string {
  const raw = (date ?? '').trim();
  if (!raw || raw === '—') return 'Undated';

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
  }

  const monthMatch = raw.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i,
  );
  if (monthMatch) {
    const m = monthMatch[1]!.slice(0, 3);
    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  }

  const token = raw.split(/[\s,/]+/)[0] ?? '';
  return token.length > 4 ? token.slice(0, 4) : token || 'Other';
}

export function pesoFormatter(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function kgFormatter(value: number): string {
  return `${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })} kg`;
}

/** Compact axis ticks for large peso/kg values. */
export function compactAxisFormatter(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

export function truncateLabel(label: string, max = 14): string {
  const s = String(label);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function piePercentLabel(name: string, percent: number | undefined): string {
  if ((percent ?? 0) < 0.06) return '';
  return `${truncateLabel(name, 10)} ${Math.round((percent ?? 0) * 100)}%`;
}

export function pieColorAt(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length]!;
}

/** Semantic fill color for a cherry ripeness bucket. */
export function cherryGradeColor(label: string, index: number): string {
  const bucket = cherryGradeBucket(label);
  switch (bucket) {
    case 'ripe':
      return CHART_CHERRY.ripe;
    case 'nearRipe':
      return CHART_CHERRY.nearRipe;
    case 'unripe':
      return CHART_CHERRY.unripe;
    case 'overripe':
      return CHART_CHERRY.overripe;
    default:
      return pieColorAt(index);
  }
}

export function cherryBucketColor(bucket: CherryGradeBucket): string {
  switch (bucket) {
    case 'ripe':
      return CHART_CHERRY.ripe;
    case 'nearRipe':
      return CHART_CHERRY.nearRipe;
    case 'unripe':
      return CHART_CHERRY.unripe;
    case 'overripe':
      return CHART_CHERRY.overripe;
    default:
      return CHART_COLORS.muted;
  }
}
