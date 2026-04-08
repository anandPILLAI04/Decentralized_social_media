import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { ToastProvider } from "./hooks/useToast";
import { SocketProvider } from "./hooks/useSocket";
import "./styles/index.css"; // optional global styles
import { BrowserRouter } from "react-router-dom";

// Wrapper component to get wallet address from AuthProvider and pass to SocketProvider
function AppWithSocket() {
  const { walletAddress } = useAuth();
  return (
    <SocketProvider walletAddress={walletAddress}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SocketProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppWithSocket />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
