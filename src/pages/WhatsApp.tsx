import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, FileText, Send, Inbox, BarChart3 } from "lucide-react";
import { MessageTemplates } from "@/components/whatsapp/MessageTemplates";
import { BulkSender } from "@/components/whatsapp/BulkSender";
import { DeliveryStatus } from "@/components/whatsapp/DeliveryStatus";
import { ReceivedMessages } from "@/components/whatsapp/ReceivedMessages";
import { mockReceivedMessages } from "@/data/mockWhatsapp";

export default function WhatsApp() {
  const unreadCount = mockReceivedMessages.filter((m) => !m.isRead).length;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#25D366] flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-heading font-bold">WhatsApp Center</h1>
            <p className="text-sm text-muted-foreground">Manage templates, send bulk messages & track delivery</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4 h-auto p-1">
            <TabsTrigger value="templates" className="text-xs gap-1 py-2">
              <FileText className="h-3.5 w-3.5 hidden sm:block" /> Templates
            </TabsTrigger>
            <TabsTrigger value="bulk" className="text-xs gap-1 py-2">
              <Send className="h-3.5 w-3.5 hidden sm:block" /> Bulk Send
            </TabsTrigger>
            <TabsTrigger value="status" className="text-xs gap-1 py-2">
              <BarChart3 className="h-3.5 w-3.5 hidden sm:block" /> Status
            </TabsTrigger>
            <TabsTrigger value="inbox" className="text-xs gap-1 py-2 relative">
              <Inbox className="h-3.5 w-3.5 hidden sm:block" /> Inbox
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-destructive">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates"><MessageTemplates /></TabsContent>
          <TabsContent value="bulk"><BulkSender /></TabsContent>
          <TabsContent value="status"><DeliveryStatus /></TabsContent>
          <TabsContent value="inbox"><ReceivedMessages /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
