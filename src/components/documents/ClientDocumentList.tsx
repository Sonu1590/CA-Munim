import { useState } from "react";
import { mockClients } from "@/data/mockClients";
import { mockDocuments } from "@/data/mockDocuments";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FolderOpen, ChevronRight } from "lucide-react";

interface Props {
  onSelectClient: (clientId: string) => void;
}

export function ClientDocumentList({ onSelectClient }: Props) {
  const [search, setSearch] = useState("");

  const clientsWithCounts = mockClients.map((c) => ({
    ...c,
    docCount: mockDocuments.filter((d) => d.clientId === c.id).length,
  }));

  const filtered = clientsWithCounts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.pan.toLowerCase().includes(search.toLowerCase())
  );

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
