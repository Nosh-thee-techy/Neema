import { useEffect, useRef } from 'react';

interface PinInputProps {
  /** Number of boxes (4–6). */
  length: number;
  value: string;
  onChange: (next: string) => void;
  /** Called once every box is filled. */
  onComplete?: (pin: string) => void;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string | undefined;
  /** Accessible name for the group, e.g. "Enter PIN". */
  label: string;
  /** e.g. (i, n) => `Digit ${i} of ${n}` */
  digitLabel: (index: number, total: number) => string;
  disabled?: boolean;
}

/**
 * One real input per digit: visible caret, auto-advance, backspace to the previous box,
 * arrow keys, and paste of the whole PIN into any box.
 */
export function PinInput({
  length,
  value,
  onChange,
  onComplete,
  autoFocus,
  invalid,
  describedBy,
  label,
  digitLabel,
  disabled,
}: PinInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  /** Latest value, updated before focus moves (props lag one render behind). */
  const latest = useRef(value);
  latest.current = value;
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (autoFocus) refs.current[Math.min(value.length, length - 1)]?.focus();
    // Only on mount / when the number of boxes changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, length]);

  function focusBox(i: number) {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  }

  /** Writes digits starting at box `from`, then moves focus to the next empty box. */
  function writeFrom(from: number, incoming: string) {
    const clean = incoming.replace(/\D/g, '');
    if (!clean) return;
    const arr = digits.slice();
    let i = from;
    for (const ch of clean) {
      if (i >= length) break;
      arr[i] = ch;
      i += 1;
    }
    // Keep the PIN contiguous: drop anything after the first gap.
    const firstGap = arr.findIndex((c) => c === '');
    const next = (firstGap === -1 ? arr : arr.slice(0, firstGap)).join('');
    latest.current = next;
    onChange(next);
    if (next.length === length) {
      refs.current[length - 1]?.blur();
      onComplete?.(next);
    } else {
      focusBox(next.length);
    }
  }

  return (
    <div className="pin-input" role="group" aria-label={label} data-error={invalid ? 'true' : 'false'}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="pin-input__box"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint={i === length - 1 ? 'done' : 'next'}
          aria-label={digitLabel(i + 1, length)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={d}
          data-filled={d !== ''}
          onFocus={(e) => {
            // Never let her type into a box after an empty one.
            if (i > latest.current.length) focusBox(latest.current.length);
            else e.currentTarget.select();
          }}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              latest.current = value.slice(0, i);
              onChange(latest.current);
              return;
            }
            // The new character is whatever is not the old one (select-all makes this the last char).
            writeFrom(i, raw.length > 1 && raw.startsWith(d) ? raw.slice(d.length) : raw);
          }}
          onPaste={(e) => {
            e.preventDefault();
            writeFrom(i, e.clipboardData.getData('text'));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (d !== '') {
                latest.current = value.slice(0, i);
                onChange(latest.current);
                focusBox(i);
              } else if (i > 0) {
                latest.current = value.slice(0, i - 1);
                onChange(latest.current);
                focusBox(i - 1);
              }
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              focusBox(i - 1);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              if (i < latest.current.length) focusBox(i + 1);
            } else if (e.key.length === 1 && !/\d/.test(e.key) && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
            }
          }}
        />
      ))}
    </div>
  );
}
