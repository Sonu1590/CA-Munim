import { useState, useEffect } from "react";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { fetchDocumentsFromSupabase } from "@/data/Documents";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FolderOpen, ChevronRight, Loader2 } from "lucide-react";

interface Props {
  onSelectClient: (clientId: string) => void;
}

export function ClientDocumentList({ onSelectClient }: Props) {
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [clientsData, documentsData] = await Promise.all([
          fetchClientsFromSupabase(),
          fetchDocumentsFromSupabase(),
        ]);
        setClients(clientsData);
        setDocuments(documentsData);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const clientsWithCounts = clients.map((c) => ({
    ...c,
    docCount: documents.filter((d) => d.clientId === c.id).length,
  }));

  const filtered = clientsWithCounts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.pan.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading clients...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients by name or PAN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3">
        {filtered.map((client) => (
          <Card
            key={client.id}
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => onSelectClient(client.id)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{client.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{client.pan}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {client.docCount} docs
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No clients found</p>
        )}
      </div>
    </div>
  );
}
