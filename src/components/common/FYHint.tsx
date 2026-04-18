import { getFinancialYear } from "@/lib/indianTaxUtils";

interface Props {
  date: string | Date | null | undefined;
  className?: string;
}

export function FYHint({ date, className = "" }: Props) {
  const fy = getFinancialYear(date);
  if (!fy) return null;
  return (
    <p className={`text-[11px] text-muted-foreground mt-1 ${className}`}>
      Falls in <span className="font-medium text-primary">{fy}</span>
    </p>
  );
}
