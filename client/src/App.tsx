import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

// GitHub Pages用のベースパス設定
const getBasePath = () => {
  // GitHub Pages環境での動作確認
  if (window.location.hostname.endsWith('github.io')) {
    // リポジトリ名をパスから取得
    const pathSegments = window.location.pathname.split('/');
    if (pathSegments.length >= 2) {
      return `/${pathSegments[1]}`;
    }
  }
  return '';
};

function Router() {
  const basePath = getBasePath();

  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;