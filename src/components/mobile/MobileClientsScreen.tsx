import { useNavigate } from "react-router-dom";
import { Search, Phone, MessageCircle } from "lucide-react";
import { Client } from "@/hooks/useClients";

interface MobileClientsScreenProps {
  clients: Client[];
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  filterOptions: string[];
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountryCode}`;
}

export function MobileClientsScreen({
  clients,
  totalCount,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  filterOptions,
}: MobileClientsScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-mobile-bg font-mobile-body text-mobile-text -mx-4 -mt-4 px-4 pt-6 pb-8 min-h-[calc(100vh-8rem)]">
      <div className="flex items-baseline gap-2 mb-3.5">
        <span className="font-mobile-heading font-normal text-2xl">Clients</span>
        <span className="text-xs font-bold bg-mobile-accent text-white rounded-full px-2.5 py-0.5">{totalCount}</span>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-mobile-neutral-500" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, PAN or phone"
          className="w-full box-border border border-mobile-neutral-300 rounded-full bg-mobile-neutral-100 py-2.5 pl-10 pr-4 text-sm text-mobile-text outline-none"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto mb-4 pb-1 -mx-4 px-4">
        {filterOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => onTypeFilterChange(opt)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${
              typeFilter === opt ? "bg-mobile-accent text-white" : "bg-mobile-surface text-mobile-text"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {clients.map((client) => (
          <div
            key={client.id}
            onClick={() => navigate(`/clients/${client.id}`)}
            className="bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm flex items-center gap-3 cursor-pointer"
          >
            <div className="shrink-0 w-11 h-11 rounded-full bg-mobile-accent-2-200 text-mobile-accent-2-800 flex items-center justify-center font-bold text-sm">
              {initialsFor(client.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{client.name}</div>
              <div className="text-xs text-mobile-neutral-600">
                {client.type} · {client.pan}
              </div>
              {client.feesOverdue && (
                <div className="text-xs font-bold text-mobile-accent-700 mt-0.5">
                  ₹{client.pendingFees.toLocaleString("en-IN")} pending
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${client.phone}`;
              }}
              className="shrink-0 w-9 h-9 rounded-full bg-mobile-surface text-mobile-neutral-700 flex items-center justify-center"
              aria-label={`Call ${client.name}`}
            >
              <Phone className="h-4 w-4" />
            </button>
            <a
              href={waLink(client.phone)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 w-9 h-9 rounded-full bg-mobile-accent-2-200 text-mobile-accent-2-800 flex items-center justify-center"
              aria-label={`WhatsApp ${client.name}`}
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
