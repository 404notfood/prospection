import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  type?: string;
  min?: number;
  max?: number;
  rows?: number;
}
export function FormField({ label, value, onChange, hint, multiline, ...props }: FieldProps) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="field-label">
        {label}
      </Label>
      {multiline ? (
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
      )}{" "}
      {hint && <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <Label className="field-label" htmlFor={id}>
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-white px-3 text-sm focus:border-ring"
      >
        {children}
      </select>
    </div>
  );
}
