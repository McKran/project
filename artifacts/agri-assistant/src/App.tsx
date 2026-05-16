import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocationProvider } from "@/hooks/use-location";
import { SettingsProvider, useSettings } from "@/hooks/use-settings";
import { Layout } from "@/components/layout";

import Dashboard from "@/pages/dashboard";
import Weather from "@/pages/weather";
import Crops from "@/pages/crops";
import Market from "@/pages/market";
import Chat from "@/pages/chat";
import Settings from "@/pages/settings";
import Onboarding from "@/pages/onboarding";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/weather" component={Weather} />
      <Route path="/crops" component={Crops} />
      <Route path="/market" component={Market} />
      <Route path="/chat" component={Chat} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const { settings } = useSettings();

  if (!settings.onboardingCompleted) {
    return <Onboarding />;
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Layout>
        <Router />
      </Layout>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SettingsProvider>
          <LocationProvider>
            <AppInner />
          </LocationProvider>
        </SettingsProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
