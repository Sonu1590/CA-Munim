import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, IndianRupee, ListChecks } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";
import { useBilling } from "@/hooks/useBilling";
import { useUserRole } from "@/hooks/useUserRole";
import { ClientCredentialsPanel } from "@/components/clients/ClientCredentialsPanel";

const formatDate = (date?: string) => date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN") : "-";

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, loading: clientsLoading } = useClients();
  const { tasks } = useTasks();
  const { invoices } = useBilling();
  const { isAdmin } = useUserRole();

  const client = clients.find((item) => item.id === id);
  const clientTasks = useMemo(() => tasks.filter((task) => task.clientId === id), [tasks, id]);
  const clientInvoices = useMemo(() => invoices.filter((invoice) => invoice.clientId === id), [invoices, id]);

  if (clientsLoading) {
    return <AppLayout><div className="p-6 text-sm text-muted-foreground">Loading client profile...</div></AppLayout>;
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="p-6 space-y-3">
          <Button variant="outline" onClick={() => navigate("/clients")}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          <p className="text-sm text-muted-foreground">Client not found.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        <Button variant="ghost" className="px-0 gap-1" onClick={() => navigate("/clients")}>
          <ArrowLeft className="h-4 w-4" /> Clients
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">{client.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{client.type}</Badge>
              {client.pan && <Badge variant="outline" className="font-mono">{client.pan}</Badge>}
              {client.gstin && <Badge variant="outline" className="font-mono">{client.gstin}</Badge>}
            </div>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <p>{client.phone || "-"}</p>
            <p>{client.email || "-"}</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            {isAdmin && <TabsTrigger value="credentials">Credentials</TabsTrigger>}
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
                <p><span className="text-muted-foreground">DOB/Incorp:</span> {formatDate(client.date_of_birth)}</p>
                <p><span className="text-muted-foreground">City:</span> {client.city || "-"}</p>
                <p><span className="text-muted-foreground">State:</span> {client.state || "-"}</p>
                <p><span className="text-muted-foreground">Address:</span> {client.address || "-"}</p>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" />Tasks</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{clientTasks.length}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><IndianRupee className="h-4 w-4" />Pending Fees</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">₹{client.pendingFees.toLocaleString("en-IN")}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <Card><CardContent className="p-0 divide-y">
              {clientTasks.length ? clientTasks.map((task) => (
                <div key={task.id} className="p-4 flex items-center justify-between gap-3">
                  <div><p className="font-medium">{task.customName || task.taskType}</p><p className="text-xs text-muted-foreground">{task.financialYear} · Due {formatDate(task.dueDate)}</p></div>
                  <Badge variant="outline" className="capitalize">{task.status.replace("_", " ")}</Badge>
                </div>
              )) : <p className="p-4 text-sm text-muted-foreground">No tasks for this client yet.</p>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card><CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" />Open Documents to manage uploaded files and requests for this client.</CardContent></Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card><CardContent className="p-0 divide-y">
              {clientInvoices.length ? clientInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4 flex items-center justify-between gap-3">
                  <div><p className="font-medium">{invoice.invoiceNumber}</p><p className="text-xs text-muted-foreground">{invoice.financialYear} · {formatDate(invoice.invoiceDate)}</p></div>
                  <div className="text-right"><p className="font-semibold">₹{invoice.total.toLocaleString("en-IN")}</p><Badge variant="outline" className="capitalize">{invoice.status.replace("_", " ")}</Badge></div>
                </div>
              )) : <p className="p-4 text-sm text-muted-foreground">No invoices for this client yet.</p>}
            </CardContent></Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="credentials">
              <ClientCredentialsPanel clientId={client.id} />
            </TabsContent>
          )}

          <TabsContent value="activity">
            <Card><CardContent className="p-4 text-sm text-muted-foreground">Last updated {formatDate(client.lastActivity)}. More audit activity can be added here as workflow events are recorded.</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
