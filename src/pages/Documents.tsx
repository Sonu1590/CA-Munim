import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientDocumentList } from "@/components/documents/ClientDocumentList";
import { ClientDocumentFolder } from "@/components/documents/ClientDocumentFolder";
import { DocumentRequestModal } from "@/components/documents/DocumentRequestModal";
import { BulkDocumentStatus } from "@/components/documents/BulkDocumentStatus";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, FolderOpen, ClipboardList } from "lucide-react";

export default function Documents() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-heading font-bold">Documents</h1>
            <p className="text-sm text-muted-foreground">Manage client documents & requests</p>
          </div>
          <Button
            onClick={() => setRequestModalOpen(true)}
            className="bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-2"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Request Document</span>
          </Button>
        </div>

        <Tabs defaultValue="folders">
          <TabsList>
            <TabsTrigger value="folders" className="gap-1.5">
              <FolderOpen className="h-4 w-4" />
              Client Folders
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5">
              <ClipboardList className="h-4 w-4" />
              Pending Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="folders">
            {selectedClientId ? (
              <ClientDocumentFolder
                clientId={selectedClientId}
                onBack={() => setSelectedClientId(null)}
              />
            ) : (
              <ClientDocumentList onSelectClient={setSelectedClientId} />
            )}
          </TabsContent>

          <TabsContent value="requests">
            <BulkDocumentStatus />
          </TabsContent>
        </Tabs>

        <DocumentRequestModal
          open={requestModalOpen}
          onOpenChange={setRequestModalOpen}
        />
      </div>
    </AppLayout>
  );
}
