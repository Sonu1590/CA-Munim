import { useState, useEffect, useMemo } from "react";
import { fetchDocumentsFromSupabase, documentCategories, type DocumentCategory } from "@/data/Documents";
import { fetchClientsFromSupabase } from "@/data/Clients";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Image, FileSpreadsheet, Download, Eye, Trash2, Share2, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clientId: string;
  onBack: () => void;
}

const fileIconMap: Record<string, typeof FileText> = {
  pdf: FileText,
  jpg: Image,
  png: Image,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  doc: FileText,
  docx: FileText,
};

export function ClientDocumentFolder({ clientId, onBack }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
  const [client, setClient] = useState<any>(null);
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
        const foundClient = clientsData.find((c) => c.id === clientId);
        setClient(foundClient);
        setDocuments(documentsData.filter((d) => d.clientId === clientId));
      } catch (err: any) {
        setError(err?.message ?? "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [clientId]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documentCategories.forEach((cat) => {
      counts[cat] = documents.filter((d) => d.category === cat).length;
    });
    return counts;
  }, [documents]);

  const visibleDocs = selectedCategory
    ? documents.filter((d) => d.category === selectedCategory)
    : documents;

  const handleAction = (action: string, fileName: string) => {
    toast.success(`${action}: ${fileName}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading documents...</span>
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="font-heading font-semibold text-lg">{client?.name}</h2>
          <p className="text-xs text-muted-foreground">{documents.length} documents</p>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedCategory === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setSelectedCategory(null)}
        >
          All ({documents.length})
        </Badge>
        {documentCategories.map((cat) => (
          <Badge
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat} ({categoryCounts[cat]})
          </Badge>
        ))}
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {visibleDocs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No documents in this category</p>
          </div>
        ) : (
          visibleDocs.map((doc) => {
            const Icon = fileIconMap[doc.fileType] || FileText;
            return (
              <Card key={doc.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-accent/50 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{doc.fileSize}</span>
                        <span>•</span>
                        <span>{new Date(doc.uploadDate).toLocaleDateString("en-IN")}</span>
                        <span>•</span>
                        <span>{doc.uploadedBy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction("Preview", doc.fileName)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction("Download", doc.fileName)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction("Share link generated for", doc.fileName)}>
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleAction("Deleted", doc.fileName)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
