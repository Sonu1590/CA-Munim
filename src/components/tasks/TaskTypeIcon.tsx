import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ClipboardPenLine,
  CreditCard,
  FileText,
  Landmark,
  Search,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconByTaskType: Record<string, LucideIcon> = {
  "GSTR-1": BarChart3,
  "GSTR-3B": BarChart3,
  "GSTR-9": BarChart3,
  "GSTR-9C": BarChart3,
  "GSTR-4": BarChart3,
  "CMP-08": BarChart3,
  "ITR Filing": FileText,
  "Advance Tax": Landmark,
  "Tax Audit": Search,
  "Form 3CD": FileText,
  "Form 26QB": FileText,
  "TDS Challan": CreditCard,
  "24Q": FileText,
  "26Q": FileText,
  "27Q": FileText,
  "27EQ": FileText,
  "Form 16": FileText,
  "Form 16A": FileText,
  "Form 27D": FileText,
  "MGT-7": Building2,
  "AOC-4": Building2,
  "DIR-3 KYC": Building2,
  "ADT-1": Building2,
  "INC-20A": Building2,
  "PAS-3": Building2,
  Bookkeeping: BookOpen,
  Payroll: BriefcaseBusiness,
  "GST Registration": ClipboardPenLine,
  "Company Incorporation": Building2,
  Custom: Zap,
};

interface TaskTypeIconProps {
  taskType: string;
  className?: string;
}

export function TaskTypeIcon({ taskType, className }: TaskTypeIconProps) {
  const Icon = iconByTaskType[taskType] ?? Zap;
  return <Icon className={cn("h-4 w-4 text-muted-foreground", className)} aria-hidden="true" />;
}
