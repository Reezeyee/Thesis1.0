export type CherryMaturityClass = 'Ripe' | 'Ripening' | 'Unripe' | 'Overripe' | 'Dry_Damaged';

export interface CherryBoundingBox {
  id: string;
  box: [number, number, number, number]; // [x1, y1, x2, y2] normalized 0-1
  pixelBox?: [number, number, number, number];
  cls: CherryMaturityClass;
  confidence: number;
}

export interface CherryDetectionResult {
  totalCount: number;
  ripeCount: number;
  ripeningCount: number;
  unripeCount: number;
  overripeCount: number;
  damagedCount: number;
  ripePercentage: number;
  harvestRecommendation: 'Ready for Harvest' | 'Selective Picking' | 'Wait / Unripe';
  harvestNote: string;
  section: string;
  workerName: string;
  timestamp: number;
  dateString: string;
  timeString: string;
  boxes: CherryBoundingBox[];
  imageUrl: string;
}

export const CLASS_STYLES: Record<
  CherryMaturityClass,
  { label: string; bg: string; text: string; border: string; colorHex: string; dotClass: string }
> = {
  Ripe: {
    label: 'Ripe',
    bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
    colorHex: '#e11d48',
    dotClass: 'bg-rose-500',
  },
  Ripening: {
    label: 'Ripening',
    bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    colorHex: '#d97706',
    dotClass: 'bg-amber-500',
  },
  Unripe: {
    label: 'Unripe',
    bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    colorHex: '#059669',
    dotClass: 'bg-emerald-500',
  },
  Overripe: {
    label: 'Overripe',
    bg: 'bg-amber-900/15 text-amber-800 dark:text-amber-300',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-900/30',
    colorHex: '#78350f',
    dotClass: 'bg-amber-800',
  },
  Dry_Damaged: {
    label: 'Damaged / Dry',
    bg: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/30',
    colorHex: '#475569',
    dotClass: 'bg-slate-500',
  },
};

export const SAMPLE_CHERRY_IMAGES = [
  {
    id: 'sample-1',
    name: 'Section D — Prime Cluster (42 Cherries)',
    section: 'Section D',
    count: 42,
    ripePct: 76,
    recommendation: 'Ready for Harvest' as const,
    url: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'sample-2',
    name: 'Section B — Mid Ripening Branch (28 Cherries)',
    section: 'Section B',
    count: 28,
    ripePct: 46,
    recommendation: 'Selective Picking' as const,
    url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'sample-3',
    name: 'Section A — Early Season Branch (35 Cherries)',
    section: 'Section A',
    count: 35,
    ripePct: 17,
    recommendation: 'Wait / Unripe' as const,
    url: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=1000&q=80',
  },
];

export function computeHarvestRecommendation(ripePercentage: number): {
  recommendation: 'Ready for Harvest' | 'Selective Picking' | 'Wait / Unripe';
  note: string;
} {
  if (ripePercentage >= 60) {
    return {
      recommendation: 'Ready for Harvest',
      note: 'Optimal maturity reached for harvesting. Recommended for batch picking.',
    };
  }
  if (ripePercentage >= 30) {
    return {
      recommendation: 'Selective Picking',
      note: 'Partial maturity. Harvest mature red cherries only, leaving green cherries to mature.',
    };
  }
  return {
    recommendation: 'Wait / Unripe',
    note: 'Cherries are predominantly unripe. Delay harvest for 7 to 14 days.',
  };
}

/**
 * Generates realistic high-density bounding boxes and counts for coffee cherry detection.
 */
export async function detectCoffeeCherries(
  imageSrc: string,
  section: string = 'Section D',
  workerName: string = 'Juan Dela Cruz',
  targetCount?: number
): Promise<CherryDetectionResult> {
  // Simulate AI model inference latency (800ms - 1400ms) for smooth animation
  await new Promise((resolve) => setTimeout(resolve, 950 + Math.random() * 450));

  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeString = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Determine cherry count (defaulting to 42 for Section D benchmark or organic count 25-50)
  const totalCount = targetCount || (section === 'Section D' ? 42 : Math.floor(28 + Math.random() * 20));

  // Determine distribution based on section
  let ripeRatio = 0.76;
  let ripeningRatio = 0.14;
  let unripeRatio = 0.08;
  let damagedRatio = 0.02;

  if (section === 'Section A') {
    ripeRatio = 0.20;
    ripeningRatio = 0.25;
    unripeRatio = 0.50;
    damagedRatio = 0.05;
  } else if (section === 'Section B') {
    ripeRatio = 0.45;
    ripeningRatio = 0.35;
    unripeRatio = 0.15;
    damagedRatio = 0.05;
  } else if (section === 'Section C') {
    ripeRatio = 0.65;
    ripeningRatio = 0.20;
    unripeRatio = 0.12;
    damagedRatio = 0.03;
  }

  const ripeCount = Math.max(1, Math.round(totalCount * ripeRatio));
  const ripeningCount = Math.max(0, Math.round(totalCount * ripeningRatio));
  const damagedCount = Math.max(0, Math.round(totalCount * damagedRatio));
  const unripeCount = Math.max(0, totalCount - ripeCount - ripeningCount - damagedCount);

  const ripePercentage = Math.round((ripeCount / totalCount) * 100);
  const { recommendation, note } = computeHarvestRecommendation(ripePercentage);

  // Generate realistic clustering bounding boxes
  const boxes: CherryBoundingBox[] = [];
  const classesList: CherryMaturityClass[] = [
    ...Array(ripeCount).fill('Ripe'),
    ...Array(ripeningCount).fill('Ripening'),
    ...Array(unripeCount).fill('Unripe'),
    ...Array(damagedCount).fill('Dry_Damaged'),
  ];

  // Cluster centers along natural branch line
  const clusterCenters = [
    { x: 0.35, y: 0.42 },
    { x: 0.52, y: 0.48 },
    { x: 0.68, y: 0.55 },
    { x: 0.45, y: 0.65 },
    { x: 0.58, y: 0.35 },
  ];

  classesList.forEach((cls, idx) => {
    const cluster = clusterCenters[idx % clusterCenters.length];
    const jitterX = (Math.random() - 0.5) * 0.36;
    const jitterY = (Math.random() - 0.5) * 0.34;
    const boxW = 0.065 + Math.random() * 0.045;
    const boxH = boxW * (0.95 + Math.random() * 0.2);

    const cx = Math.min(0.92, Math.max(0.08, cluster.x + jitterX));
    const cy = Math.min(0.90, Math.max(0.10, cluster.y + jitterY));

    const x1 = Math.max(0.02, cx - boxW / 2);
    const y1 = Math.max(0.02, cy - boxH / 2);
    const x2 = Math.min(0.98, cx + boxW / 2);
    const y2 = Math.min(0.98, cy + boxH / 2);

    boxes.push({
      id: `cherry-${idx + 1}`,
      box: [x1, y1, x2, y2],
      cls,
      confidence: Math.round((0.85 + Math.random() * 0.14) * 100) / 100,
    });
  });

  return {
    totalCount,
    ripeCount,
    ripeningCount,
    unripeCount,
    overripeCount: 0,
    damagedCount,
    ripePercentage,
    harvestRecommendation: recommendation,
    harvestNote: note,
    section,
    workerName,
    timestamp: now.getTime(),
    dateString,
    timeString,
    boxes,
    imageUrl: imageSrc,
  };
}
