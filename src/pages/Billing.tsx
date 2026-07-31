import { useState, useMemo, useEffect, useCallback, useDeferredValue } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoiceList } from "@/components/billing/InvoiceList";
import { CreateInvoiceModal } from "@/components/billing/CreateInvoiceModal";
import { RecordPaymentModal } from "@/components/billing/RecordPaymentModal";
import { FeesDashboard } from "@/components/billing/FeesDashboard";
import { MobileBillingScreen } from "@/components/mobile/MobileBillingScreen";
import { fetchInvoicesFromSupabase, Invoice, InvoiceStatus } from "@/data/Billing";
import { Plus, Search, AlertCircle, ShieldAlert } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { CardListSkeleton } from "@/components/common/CardListSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const statusFilters: (InvoiceStatus | "All")[] = ["All", "Draft", "Sent", "Paid", "Partially Paid", "Overdue", "Cancelled"];

export default function Billing() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInvoicesFromSupabase();
      setInvoices(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // M33, ISSUES.md — see the same note in pages/Clients.tsx.
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.clientName.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        inv.invoiceNumber.toLowerCase().includes(deferredSearch.toLowerCase());
      const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, deferredSearch, statusFilter]);

  // M29, ISSUES.md — was a blank-page spinner; skeletons matching the real
  // table/card layout avoid the layout-shift "pop-in" once real rows land.
  if (roleLoading || loading) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
          <span className="sr-only" role="status">Loading invoices...</span>
          <div className="hidden md:flex md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="hidden md:block space-y-4">
            <Skeleton className="h-9 w-64" />
            <div className="flex flex-col sm:flex-row gap-3">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-full sm:w-44" />
            </div>
            <TableSkeleton columns={8} />
          </div>
          <div className="md:hidden">
            <CardListSkeleton count={6} />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Enforced server-side too (invoices/payments RLS is admin-only) — this
  // is just so a staff member sees a clear message instead of an empty
  // list or a raw permission error.
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Billing & Fees is only available to firm admins.</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={loadInvoices}>Try Again</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        <div className="hidden md:flex md:items-center justify-between gap-3" data-testid="desktop-billing-header">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-display font-bold">Billing & Fees</h1>
            <Badge className="bg-primary text-primary-foreground text-xs">{invoices.length}</Badge>
          </div>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Invoice
          </Button>
        </div>

        <div className="hidden md:block" data-testid="desktop-billing">
          <Tabs defaultValue="invoices">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="dashboard">Fees Dashboard</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by client or invoice number..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusFilters.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <InvoiceList invoices={filtered} onRecordPayment={setPaymentInvoice} />
            </TabsContent>

            <TabsContent value="dashboard">
              <FeesDashboard invoices={invoices} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="md:hidden" data-testid="mobile-billing">
          <MobileBillingScreen invoices={invoices} onRecordPayment={setPaymentInvoice} onCreateInvoice={() => setCreateOpen(true)} />
        </div>

        <CreateInvoiceModal open={createOpen} onOpenChange={setCreateOpen} onCreated={loadInvoices} />
        <RecordPaymentModal
          open={!!paymentInvoice}
          onOpenChange={(open) => !open && setPaymentInvoice(null)}
          invoice={paymentInvoice}
          onRecorded={loadInvoices}
        />
      </div>
    </AppLayout>
  );
}
