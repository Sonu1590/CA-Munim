import { useState, useMemo, useDeferredValue } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientListTable } from "@/components/clients/ClientListTable";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { MobileClientsScreen } from "@/components/mobile/MobileClientsScreen";
import { ImportClientsModal } from "@/components/clients/ImportClientsModal";
import { useClients, Client } from "@/hooks/useClients";   // ← CHANGED from mockClients
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/common/PaginationControls";
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
import { Plus, Search, AlertCircle, FileSpreadsheet } from "lucide-react";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { CardListSkeleton } from "@/components/common/CardListSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const filterOptions = [
  "All", "Individual", "HUF", "Sole Proprietor", "Partnership",
  "LLP", "Private Ltd", "Public Ltd", "Trust"
];

export default function Clients() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // ── Real data from Supabase ──────────────────────────────────────────────
  const { clients, loading, error, addClient, updateClient, refetch } = useClients();

  // M33, ISSUES.md — deferring the expensive filter/render (not the input
  // itself, which stays bound to the immediate `search` state so typing
  // never lags) avoids re-filtering the full client list on every keystroke.
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        c.pan.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        c.phone.includes(deferredSearch);
      const matchesType = typeFilter === "All" || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [clients, deferredSearch, typeFilter]);

  // M27, ISSUES.md — the desktop table and mobile card list share one
  // page of results rather than each paginating independently, since
  // both trees are mounted simultaneously (CSS-hidden, not unmounted).
  const { paginated, page, setPage, totalPages, totalItems, pageSize } = usePagination(filtered, 25);

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
  // M29, ISSUES.md — was a blank-page spinner; skeletons matching the real
  // table/card layout avoid the layout-shift "pop-in" once real rows land.
  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
          <span className="sr-only" role="status">Loading clients...</span>
          <div className="hidden md:flex md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
          <div className="hidden md:flex flex-col sm:flex-row gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-full sm:w-44" />
          </div>
          <div className="hidden md:block">
            <TableSkeleton columns={7} />
          </div>
          <div className="md:hidden">
            <CardListSkeleton count={6} />
          </div>
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
        {/* Header — desktop only; mobile screen owns its own header */}
        <div className="hidden md:flex md:items-center justify-between gap-3" data-testid="desktop-clients-header">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-heading font-medium">Clients</h1>
            <Badge className="bg-primary text-primary-foreground text-xs">
              {clients.length}
            </Badge>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setImportModalOpen(true)}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Import from Excel
            </Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90 flex-1 sm:flex-none"
              onClick={openAddClient}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Search & Filter — desktop only; MobileClientsScreen renders its own
            search/filter UI below, bound to the same search/typeFilter state.
            This block was missing its visibility guard (H8, ISSUES.md),
            so it rendered a second search bar + filter dropdown on mobile,
            stacked above MobileClientsScreen's own. */}
        <div className="hidden md:flex flex-col sm:flex-row gap-3">
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
            <div className="hidden md:block" data-testid="desktop-clients">
              <ClientListTable clients={paginated} onEdit={handleEdit} onView={handleView} />
            </div>
            <div className="md:hidden" data-testid="mobile-clients">
              <MobileClientsScreen
                clients={paginated}
                totalCount={clients.length}
                search={search}
                onSearchChange={setSearch}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
                filterOptions={filterOptions}
              />
            </div>
            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
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

        <ImportClientsModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          onImported={refetch}
        />
      </div>
    </AppLayout>
  );
}
