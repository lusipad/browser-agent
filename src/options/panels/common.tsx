import { useEffect, useState } from 'react';
import type { AppConfig } from '../../shared/types';

export interface PanelProps {
  cfg: AppConfig;
  onChange: (next: AppConfig) => void | Promise<void>;
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function NumberInput({
  value,
  min,
  max,
  step,
  fallback,
  placeholder,
  onChange,
}: {
  value: number | null | undefined;
  min: number;
  max: number;
  step?: number;
  fallback: number | null;
  placeholder?: string;
  onChange: (val: number | null) => void;
}) {
  const [localVal, setLocalVal] = useState<string>(value == null ? '' : String(value));

  useEffect(() => {
    setLocalVal(value == null ? '' : String(value));
  }, [value]);

  function commit() {
    const trimmed = localVal.trim();
    if (trimmed === '') {
      onChange(fallback);
      setLocalVal(fallback == null ? '' : String(fallback));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      onChange(fallback);
      setLocalVal(fallback == null ? '' : String(fallback));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    onChange(clamped);
    setLocalVal(String(clamped));
  }

  return (
    <input
      type="number"
      value={localVal}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
}
