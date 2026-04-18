import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { VerticalsProvider } from "@/contexts/VerticalsContext";
import { AISettingsProvider } from "@/contexts/AISettingsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import CampaignBuilder from "./pages/CampaignBuilder";
import CampaignDetail from "./pages/CampaignDetail";
import ContactDetail from "./pages/ContactDetail";
import Pipeline from "./pages/Pipeline";
import DealDetail from "./pages/DealDetail";
import ContactManager from "./pages/ContactManager";
import LinkedInQueue from "./pages/LinkedInQueue";
import InboxPage from "./pages/Inbox";
import Templates from "./pages/Templates";
import SettingsPage from "./pages/Settings";
import Login from "./pages/Login";
import Unsubscribe from "./pages/Unsubscribe";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AISettingsProvider>
        <VerticalsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/oauth/callback" element={<ProtectedRoute><OAuthCallback /></ProtectedRoute>} />

                {/* Protected */}
                <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
                <Route path="/inbox" element={<ProtectedRoute><AppLayout><InboxPage /></AppLayout></ProtectedRoute>} />
                <Route path="/campaigns/new" element={<ProtectedRoute><AppLayout><CampaignBuilder /></AppLayout></ProtectedRoute>} />
                <Route path="/pipeline" element={<ProtectedRoute><AppLayout><Pipeline /></AppLayout></ProtectedRoute>} />
                <Route path="/pipeline/:dealId" element={<ProtectedRoute><AppLayout><DealDetail /></AppLayout></ProtectedRoute>} />
                <Route path="/campaigns/:id" element={<ProtectedRoute><AppLayout><CampaignDetail /></AppLayout></ProtectedRoute>} />
                <Route path="/contacts" element={<ProtectedRoute><AppLayout><ContactManager /></AppLayout></ProtectedRoute>} />
                <Route path="/contacts/:contactId" element={<ProtectedRoute><AppLayout><ContactDetail /></AppLayout></ProtectedRoute>} />
                <Route path="/linkedin" element={<ProtectedRoute><AppLayout><LinkedInQueue /></AppLayout></ProtectedRoute>} />
                <Route path="/templates" element={<ProtectedRoute><AppLayout><Templates /></AppLayout></ProtectedRoute>} />

                {/* Admin only */}
                <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </VerticalsProvider>
      </AISettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
