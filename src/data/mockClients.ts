export type ClientType = "Individual" | "HUF" | "Sole Proprietor" | "Partnership" | "LLP" | "Private Ltd" | "Public Ltd" | "Trust" | "Society" | "AOP" | "BOI";

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  pan: string;
  phone: string;
  email: string;
  gstin?: string;
  activeTasks: number;
  pendingFees: number;
  feesOverdue: boolean;
  lastActivity: string;
  city: string;
  state: string;
  servicesSubscribed: string[];
}

export const mockClients: Client[] = [
  {
    id: "1",
    name: "Ramesh Kumar Gupta",
    type: "Individual",
    pan: "ABCPG1234F",
    phone: "9876543210",
    email: "ramesh@email.com",
    activeTasks: 3,
    pendingFees: 15000,
    feesOverdue: true,
    lastActivity: "2025-04-10",
    city: "Mumbai",
    state: "Maharashtra",
    servicesSubscribed: ["ITR Filing", "GST Returns"],
  },
  {
    id: "2",
    name: "Mehta Traders",
    type: "Partnership",
    pan: "AABFM5678K",
    phone: "9123456789",
    email: "mehtatra@gmail.com",
    gstin: "27AABFM5678K1Z5",
    activeTasks: 5,
    pendingFees: 42000,
    feesOverdue: false,
    lastActivity: "2025-04-12",
    city: "Pune",
    state: "Maharashtra",
    servicesSubscribed: ["GST Returns", "TDS Returns", "Bookkeeping"],
  },
  {
    id: "3",
    name: "Priya Sharma",
    type: "Individual",
    pan: "BKSPS9012L",
    phone: "9988776655",
    email: "priya.sharma@email.com",
    activeTasks: 1,
    pendingFees: 0,
    feesOverdue: false,
    lastActivity: "2025-04-08",
    city: "Delhi",
    state: "Delhi",
    servicesSubscribed: ["ITR Filing"],
  },
  {
    id: "4",
    name: "Sunrise Technologies Pvt Ltd",
    type: "Private Ltd",
    pan: "AABCS3456H",
    phone: "9001234567",
    email: "accounts@sunrisetech.in",
    gstin: "29AABCS3456H1ZP",
    activeTasks: 8,
    pendingFees: 125000,
    feesOverdue: true,
    lastActivity: "2025-04-13",
    city: "Bangalore",
    state: "Karnataka",
    servicesSubscribed: ["GST Returns", "TDS Returns", "ROC / MCA Compliance", "Tax Audit"],
  },
  {
    id: "5",
    name: "Gupta & Sons HUF",
    type: "HUF",
    pan: "AAAHG7890J",
    phone: "9871234560",
    email: "guptahuf@email.com",
    activeTasks: 2,
    pendingFees: 8000,
    feesOverdue: false,
    lastActivity: "2025-04-06",
    city: "Jaipur",
    state: "Rajasthan",
    servicesSubscribed: ["ITR Filing", "Bookkeeping"],
  },
  {
    id: "6",
    name: "Patel Associates LLP",
    type: "LLP",
    pan: "AACFP2345M",
    phone: "9812345678",
    email: "info@patelllp.com",
    gstin: "24AACFP2345M1ZQ",
    activeTasks: 4,
    pendingFees: 55000,
    feesOverdue: false,
    lastActivity: "2025-04-11",
    city: "Ahmedabad",
    state: "Gujarat",
    servicesSubscribed: ["GST Returns", "ROC / MCA Compliance", "TDS Returns"],
  },
  {
    id: "7",
    name: "Anil Joshi",
    type: "Sole Proprietor",
    pan: "ABCPJ6789N",
    phone: "9765432109",
    email: "anil.joshi@email.com",
    gstin: "27ABCPJ6789N1Z8",
    activeTasks: 2,
    pendingFees: 12000,
    feesOverdue: true,
    lastActivity: "2025-04-09",
    city: "Nagpur",
    state: "Maharashtra",
    servicesSubscribed: ["GST Returns", "ITR Filing"],
  },
  {
    id: "8",
    name: "Bharat Trust Foundation",
    type: "Trust",
    pan: "AAATB1234Q",
    phone: "9654321098",
    email: "trust@bharatfdn.org",
    activeTasks: 1,
    pendingFees: 25000,
    feesOverdue: false,
    lastActivity: "2025-04-05",
    city: "Chennai",
    state: "Tamil Nadu",
    servicesSubscribed: ["ITR Filing", "Bookkeeping"],
  },
];
