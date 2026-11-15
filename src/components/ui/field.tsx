// Labelled form controls with hint and error text linked through aria-describedby.
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const control =
  "w-full min-h-12 rounded-2xl bg-card px-4 text-base text-ink ring-1 ring-inset ring-ink/25 transition-shadow hover:ring-ink/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-olive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger";

type Common = { label: string; name: string; hint?: string; error?: string; id?: string };

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function Shell({
  id,
  label,
  hint,
  error,
  children,
  required,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-muted"> (required)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  hint,
  error,
  id,
  className = "",
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const fid = id ?? `f-${name}`;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} required={rest.required}>
      <input
        id={fid}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        className={`${control} ${className}`}
        {...rest}
      />
    </Shell>
  );
}

export function TextArea({
  label,
  name,
  hint,
  error,
  id,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fid = id ?? `f-${name}`;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} required={rest.required}>
      <textarea
        id={fid}
        name={name}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        className={`${control} py-3`}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  name,
  hint,
  error,
  id,
  options,
  ...rest
}: Common &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: ReadonlyArray<{ value: string; label: string }>;
  }) {
  const fid = id ?? `f-${name}`;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} required={rest.required}>
      <select
        id={fid}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        className={`${control} appearance-none bg-[length:1.25rem] bg-[right_1rem_center] bg-no-repeat pr-12`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

/** Group of checkboxes or radios rendered as large tappable pills. */
export function ChoiceGroup({
  legend,
  name,
  type,
  options,
  defaultValues = [],
  hint,
  error,
}: {
  legend: string;
  name: string;
  type: "checkbox" | "radio";
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValues?: ReadonlyArray<string>;
  hint?: string;
  error?: string;
}) {
  const id = `g-${name}`;
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={describedBy(id, hint, error)}>
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="relative inline-flex min-h-11 cursor-pointer items-center rounded-full bg-card px-4 text-sm font-semibold ring-1 ring-inset ring-ink/25 has-[:checked]:bg-ink has-[:checked]:text-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-olive"
          >
            <input
              type={type}
              name={name}
              value={o.value}
              defaultChecked={defaultValues.includes(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
