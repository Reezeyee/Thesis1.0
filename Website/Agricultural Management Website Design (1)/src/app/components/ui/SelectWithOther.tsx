import { useState, useEffect, useMemo } from 'react';

export type SelectOption = string | { value: string; label: string };

interface SelectWithOtherProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: readonly SelectOption[] | SelectOption[];
  placeholder?: string;
  otherPlaceholder?: string;
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
  id?: string;
}

export function SelectWithOther({
  label,
  value,
  onChange,
  options,
  placeholder,
  otherPlaceholder = 'Type custom value...',
  className = 'space-y-2',
  selectClassName = 'flex h-9 w-full rounded-md border border-border/80 bg-background/80 px-3 py-1 text-sm text-foreground',
  inputClassName = 'flex h-9 w-full rounded-md border border-border/80 bg-background/80 px-3 py-1 text-sm text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all',
  id,
}: SelectWithOtherProps) {
  const normalizedOptions = useMemo<{ value: string; label: string }[]>(() => {
    const list = Array.from(options).map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
    if (!list.some((o) => o.value.toLowerCase() === 'other' || o.value.toLowerCase() === 'other...')) {
      list.push({ value: 'Other', label: 'Other' });
    }
    return list;
  }, [options]);

  const isPreset = normalizedOptions.some(
    (o) => o.value.toLowerCase() !== 'other' && o.value.toLowerCase() !== 'other...' && o.value === value
  );

  const [isOtherSelected, setIsOtherSelected] = useState<boolean>(!isPreset && Boolean(value));
  const [customText, setCustomText] = useState<string>(!isPreset ? value : '');

  useEffect(() => {
    const presetMatch = normalizedOptions.some(
      (o) => o.value.toLowerCase() !== 'other' && o.value.toLowerCase() !== 'other...' && o.value === value
    );
    if (presetMatch) {
      setIsOtherSelected(false);
    } else if (value) {
      setIsOtherSelected(true);
      setCustomText(value);
    }
  }, [value, normalizedOptions]);

  const handleSelectChange = (selectedValue: string) => {
    const isOtherOption = selectedValue.toLowerCase() === 'other' || selectedValue.toLowerCase() === 'other...';
    if (isOtherOption) {
      setIsOtherSelected(true);
      onChange(customText || '');
    } else {
      setIsOtherSelected(false);
      onChange(selectedValue);
    }
  };

  const handleInputChange = (text: string) => {
    setCustomText(text);
    onChange(text);
  };

  const selectValue = isOtherSelected
    ? (normalizedOptions.find((o) => o.value.toLowerCase() === 'other' || o.value.toLowerCase() === 'other...')?.value || 'Other')
    : value;

  return (
    <div className={className}>
      {label ? <label className="text-sm font-medium text-foreground block">{label}</label> : null}
      <select
        id={id}
        className={selectClassName}
        value={selectValue}
        onChange={(e) => handleSelectChange(e.target.value)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {isOtherSelected && (
        <input
          type="text"
          className={inputClassName}
          value={customText}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={otherPlaceholder}
          autoFocus
        />
      )}
    </div>
  );
}
