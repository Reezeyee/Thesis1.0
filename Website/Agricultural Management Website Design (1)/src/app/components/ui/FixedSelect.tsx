import { Label } from './label';

const SELECT_CLASS = 'flex h-9 w-full rounded-md border border-border/80 bg-background/80 px-3 py-1 text-sm text-foreground';

/**
 * Dropdown with a fixed set of choices -- no free-text "Other". A record saved before "Other" was
 * removed may hold a custom value; it is kept as an extra option so editing that record doesn't
 * blank it or silently change it to the first choice.
 */
export function FixedSelect({
  id,
  label,
  value,
  options,
  onChange,
  selectClassName = SELECT_CLASS,
  className = 'space-y-1.5',
}: {
  id?: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  selectClassName?: string;
  className?: string;
}) {
  const list = !value || options.includes(value) ? options : [...options, value];
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-xs font-semibold">{label}</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClassName}>
        {list.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
