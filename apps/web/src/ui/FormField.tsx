import type { ReactNode } from 'react';

interface FieldProps {
  id: string;
  label: ReactNode;
  required?: boolean;
  /** Shown under the label when the field is optional. */
  optionalText?: string;
  error?: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
}

/** Label + control + hint + error, the same everywhere. Errors get id `${id}-error`. */
export function FormField({ id, label, required, optionalText, error, hint, children }: FieldProps) {
  return (
    <div className="field n-field" data-invalid={error ? 'true' : undefined}>
      <label htmlFor={id} className="n-label">
        {label}
        {required ? <RequiredMark /> : optionalText ? <span className="n-optional">{optionalText}</span> : null}
      </label>
      {children}
      {error ? <FieldError id={`${id}-error`} message={error} /> : null}
      {hint ? <div className="n-hint">{hint}</div> : null}
    </div>
  );
}

/** Visible asterisk + "required" for screen readers. */
export function RequiredMark() {
  return (
    <span className="n-req">
      <span aria-hidden>*</span>
      <span className="sr-only"> (required)</span>
    </span>
  );
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p className="field-error n-error" id={id} role="alert">
      <svg viewBox="0 0 20 20" aria-hidden width="16" height="16">
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <path d="M10 5.5v5.5M10 13.6v.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </p>
  );
}

/** Props to wire an input to its error message. */
export function invalidProps(id: string, error: string | undefined) {
  return error ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};
}
