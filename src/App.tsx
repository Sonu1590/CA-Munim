import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Clients from "./pages/Clients.tsx";
import Tasks from "./pages/Tasks.tsx";
import Documents from "./pages/Documents.tsx";
import WhatsApp from "./pages/WhatsApp.tsx";
import Billing from "./pages/Billing.tsx";
import Reports from "./pages/Reports.tsx";
import Settings from "./pages/Settings.tsx";
import PenaltyCalculator from "./pages/PenaltyCalculator.tsx";
import NotFound from "./pages/NotFound.tsx";
import { GlobalSearch } from "./components/common/GlobalSearch";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <GlobalSearch />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/penalty-calculator" element={<PenaltyCalculator />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/whatsapp" element={<WhatsApp />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
