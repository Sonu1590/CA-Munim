import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientListTable } from "@/components/clients/ClientListTable";
import { ClientCards } from "@/components/clients/ClientCards";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { mockClients, Client } from "@/data/mockClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";

const filterOptions = ["All", "Individual", "HUF", "Sole Proprietor", "Partnership", "LLP", "Private Ltd", "Public Ltd", "Trust"];

export default function Clients() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return mockClients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.pan.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search);
      const matchesType = typeFilter === "All" || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [search, typeFilter]);

  const handleEdit = (client: Client) => {
    setModalOpen(true);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-heading font-bold">Clients</h1>
            <Badge className="bg-primary text-primary-foreground text-xs">
              {mockClients.length}
            </Badge>
          </div>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Client
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, PAN, or phone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No clients found matching your search.
          </div>
        ) : (
          <>
            <ClientListTable clients={filtered} onEdit={handleEdit} />
            <ClientCards clients={filtered} onEdit={handleEdit} />
          </>
        )}

        <AddClientModal open={modalOpen} onOpenChange={setModalOpen} />
      </div>
    </AppLayout>
  );
}
