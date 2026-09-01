import React from 'react';

export interface DashboardGridProps {
  children: React.ReactNode;
  className?: string;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ children, className = '' }) => {
  return (
    <div className={`grid grid-cols-12 gap-4 md:gap-6 ${className}`}>
      {children}
    </div>
  );
};

export interface GridItemProps {
  children: React.ReactNode;
  span?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  className?: string;
}

// Explicit static Tailwind class mappings so Tailwind scanner detects all col-span utilities
const defaultColSpans: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
};

const smColSpans: Record<number, string> = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  5: 'sm:col-span-5',
  6: 'sm:col-span-6',
  7: 'sm:col-span-7',
  8: 'sm:col-span-8',
  9: 'sm:col-span-9',
  10: 'sm:col-span-10',
  11: 'sm:col-span-11',
  12: 'sm:col-span-12',
};

const mdColSpans: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
};

const lgColSpans: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
};

const xlColSpans: Record<number, string> = {
  1: 'xl:col-span-1',
  2: 'xl:col-span-2',
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  11: 'xl:col-span-11',
  12: 'xl:col-span-12',
};

export const GridItem: React.FC<GridItemProps> = ({ children, span = { default: 12, lg: 6 }, className = '' }) => {
  const classes: string[] = [];
  
  if (span.default && defaultColSpans[span.default]) classes.push(defaultColSpans[span.default]);
  if (span.sm && smColSpans[span.sm]) classes.push(smColSpans[span.sm]);
  if (span.md && mdColSpans[span.md]) classes.push(mdColSpans[span.md]);
  if (span.lg && lgColSpans[span.lg]) classes.push(lgColSpans[span.lg]);
  if (span.xl && xlColSpans[span.xl]) classes.push(xlColSpans[span.xl]);

  return <div className={`${classes.join(' ')} ${className}`}>{children}</div>;
};
