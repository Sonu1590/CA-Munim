import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { getCurrentFinancialYear } from "@/lib/indianTaxUtils";
import { financialYears as defaultFinancialYears } from "@/data/Tasks";

interface FinancialYearContextValue {
  selectedFY: string;
  setSelectedFY: (value: string) => void;
  availableFinancialYears: string[];
}

const FinancialYearContext = createContext<FinancialYearContextValue | undefined>(undefined);

export function FinancialYearProvider({ children }: { children: ReactNode }) {
  const currentFY = getCurrentFinancialYear();
  const [selectedFY, setSelectedFY] = useState(currentFY);

  const availableFinancialYears = useMemo(() => {
    const uniqueYears = [currentFY, ...defaultFinancialYears.filter((fy) => fy !== currentFY)];
    return uniqueYears;
  }, [currentFY]);

  return (
    <FinancialYearContext.Provider value={{ selectedFY, setSelectedFY, availableFinancialYears }}>
      {children}
    </FinancialYearContext.Provider>
  );
}

export function useFinancialYear() {
  const context = useContext(FinancialYearContext);
  if (!context) {
    throw new Error("useFinancialYear must be used within a FinancialYearProvider");
  }
  return context;
}
