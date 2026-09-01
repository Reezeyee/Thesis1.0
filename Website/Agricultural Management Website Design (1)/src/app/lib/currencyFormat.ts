/**
 * Standard monetary and number formatting utilities.
 * Ensures consistent two decimal places and commas for thousands (e.g. 1000 -> 1,000.00, 2500 -> 2,500.00, 15000.5 -> 15,000.50).
 */

export function formatCurrency(
  amount: number | string | null | undefined,
  includeSymbol: boolean = true,
): string {
  if (amount === null || amount === undefined || amount === '') {
    return includeSymbol ? '₱0.00' : '0.00';
  }

  const num = typeof amount === 'number' ? amount : Number(String(amount).replace(/[₱,\s]/g, ''));

  if (!Number.isFinite(num)) {
    return includeSymbol ? '₱0.00' : '0.00';
  }

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return includeSymbol ? `₱${formatted}` : formatted;
}

export function formatNumber(
  val: number | string | null | undefined,
  decimals: number = 2,
): string {
  if (val === null || val === undefined || val === '') {
    return '0.00';
  }

  const num = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''));

  if (!Number.isFinite(num)) {
    return '0.00';
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatInteger(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') {
    return '0';
  }

  const num = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''));

  if (!Number.isFinite(num)) {
    return '0';
  }

  return Math.round(num).toLocaleString('en-US');
}
