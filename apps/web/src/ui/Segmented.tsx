import { useRef, type ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Small dot (e.g. unread alert) shown on the tab. */
  dot?: boolean;
}

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T | '';
  onChange: (value: T) => void;
  /** 'tabs' switches panels (role=tablist); 'radio' picks one answer (role=radiogroup). */
  mode?: 'tabs' | 'radio';
  ariaLabel: string;
  /** For tabs: ids become `${idPrefix}-tab-${value}` and point at `${idPrefix}-panel-${value}`. */
  idPrefix?: string;
  invalid?: boolean;
  describedBy?: string | undefined;
  className?: string;
}

/**
 * The one tab / segmented-choice pattern used across Neema (History sections,
 * registration choices). Arrow keys move between options; Home/End jump.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  mode = 'radio',
  ariaLabel,
  idPrefix,
  invalid,
  describedBy,
  className = '',
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = mode === 'tabs';
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  function move(to: number) {
    const i = (to + options.length) % options.length;
    refs.current[i]?.focus();
    onChange(options[i]!.value);
  }

  return (
    <div
      className={`n-tabs ${className}`.trim()}
      role={tabs ? 'tablist' : 'radiogroup'}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      style={{ ['--n-tabs-count' as string]: options.length }}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            className="n-tab"
            role={tabs ? 'tab' : 'radio'}
            id={idPrefix ? `${idPrefix}-tab-${o.value}` : undefined}
            aria-controls={tabs && idPrefix ? `${idPrefix}-panel-${o.value}` : undefined}
            aria-selected={tabs ? selected : undefined}
            aria-checked={tabs ? undefined : selected}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                move(i + 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(i - 1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                move(0);
              } else if (e.key === 'End') {
                e.preventDefault();
                move(options.length - 1);
              }
            }}
          >
            {o.label}
            {o.dot ? <i className="n-tab__dot" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
