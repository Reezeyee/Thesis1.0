import { Check, Leaf } from 'lucide-react';

export const SPECIES_OPTIONS = ['Robusta', 'Liberica'] as const;
export type SpeciesOption = (typeof SPECIES_OPTIONS)[number];

interface SpeciesPickerProps {
  label?: string;
  value: string;
  onChange: (val: SpeciesOption) => void;
  className?: string;
}

/**
 * Card-style picker restricted to the two species the CNN classifier
 * (CoffeeSpeciesTfliteClassifier) actually recognizes, so a field's
 * declared variety always matches a possible scanner result.
 */
export function SpeciesPicker({ label = 'Variety (Species)', value, onChange, className = 'space-y-2' }: SpeciesPickerProps) {
  return (
    <div className={className}>
      {label ? <label className="text-sm font-medium text-foreground block">{label}</label> : null}
      <div className="grid grid-cols-2 gap-3">
        {SPECIES_OPTIONS.map((option) => {
          const isSelected = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={isSelected}
              className={`relative flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-all ${
                isSelected
                  ? 'border-accent bg-accent/10 text-accent-foreground ring-2 ring-accent/20'
                  : 'border-border/80 bg-background/80 text-foreground hover:border-accent/50'
              }`}
            >
              <Leaf className={`h-4 w-4 shrink-0 ${isSelected ? 'text-accent' : 'text-muted-foreground'}`} />
              <span>{option}</span>
              {isSelected ? <Check className="h-4 w-4 shrink-0 ml-auto text-accent" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
