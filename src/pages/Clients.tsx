import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientListTable } from "@/components/clients/ClientListTable";
import { ClientCards } from "@/components/clients/ClientCards";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { useClients, Client } from "@/hooks/useClients";   // ← CHANGED from mockClients
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Loader2, AlertCircle } from "lucide-react";

const filterOptions = [
  "All", "Individual", "HUF", "Sole Proprietor", "Partnership",
  "LLP", "Private Ltd", "Public Ltd", "Trust"
];

export default function Clients() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // ── Real data from Supabase ──────────────────────────────────────────────
  const { clients, loading, error, addClient, updateClient, refetch } = useClients();

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.pan.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search);
      const matchesType = typeFilter === "All" || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [clients, search, typeFilter]);

  const openAddClient = () => {
    setEditingClient(null);
    setModalOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const handleView = (client: Client) => {
    window.history.pushState(null, "", `/clients/${client.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading clients...</span>
        </div>
      </AppLayout>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refetch}>Try Again</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-heading font-bold">Clients</h1>
            <Badge className="bg-primary text-primary-foreground text-xs">
              {clients.length}
            </Badge>
          </div>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
            onClick={openAddClient}
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
          <div className="text-center py-16 text-muted-foreground">
            {clients.length === 0 ? (
              <div className="space-y-3">
                <p className="text-lg font-medium">No clients added yet</p>
                <p className="text-sm">Add your first client to get started.</p>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90 mt-2"
                  onClick={openAddClient}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Client
                </Button>
              </div>
            ) : (
              <p>No clients found matching your search.</p>
            )}
          </div>
        ) : (
          <>
            <ClientListTable clients={filtered} onEdit={handleEdit} onView={handleView} />
            <ClientCards clients={filtered} onEdit={handleEdit} onView={handleView} />
          </>
        )}

        <AddClientModal
          open={modalOpen}
          client={editingClient}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setEditingClient(null);
          }}
          onSave={async (formData) => {
            const result = editingClient
              ? await updateClient(editingClient.id, formData)
              : await addClient(formData);

            if (result.success) {
              toast.success(editingClient ? "Client updated" : "Client added");
              setModalOpen(false);
              setEditingClient(null);
            } else {
              toast.error(result.error ?? "Could not save client. Please check the details and try again.");
            }
            return result;
          }}
        />
      </div>
    </AppLayout>
  );
}
