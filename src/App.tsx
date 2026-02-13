import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeContextProvider } from './contexts/ThemeContext';
import { DialogProvider } from './contexts/DialogContext';
import { validateEnv } from './utils/envValidation';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import ResetPassword from './components/ResetPassword';
import VerifyEmail from './components/VerifyEmail';
import SetNewPassword from './components/SetNewPassword';
import Success from './components/Success';
import Dashboard from './components/Dashboard';
import CreateVoiceAgent from './components/CreateVoiceAgent';
import VoiceAgents from './components/VoiceAgents';
import Profile from './components/Profile';
import InboundNumbers from './components/InboundNumbers';
import CallSchedules from './components/CallSchedules';
import CallHistory from './components/CallHistory';
import Leads from './components/Leads';
import Billing from './components/Billing';
import KnowledgeBases from './components/KnowledgeBases';
import TwoFactorAuth from './components/TwoFactorAuth';
import LoginActivity from './components/LoginActivity';
import AccountDeactivation from './components/AccountDeactivation';
import Email from './components/Email';
import AIPrompt from './components/AIPrompt';
import ProtectedLayout from './components/layout/ProtectedLayout';
import ErrorBoundary from './components/ErrorBoundary';


const queryClient = new QueryClient();

const App: React.FC = () => {
  // Validate environment variables on app startup
  useEffect(() => {
    const validation = validateEnv();
    if (!validation.valid) {
      console.error('Environment validation failed:', validation.errors);
      if (process.env.NODE_ENV === 'production') {
        console.error('Critical environment variables are missing. Please check your configuration.');
      }
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeContextProvider>
          <AuthProvider>
            <DialogProvider>
              <Sonner />
              <Router>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/set-new-password" element={<SetNewPassword />} />
                <Route path="/success" element={<Success />} />

                {/* Protected routes - shared layout stays mounted across navigation */}
                <Route element={<ProtectedLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/create-agent" element={<CreateVoiceAgent />} />
                  <Route path="/edit-agent/:id" element={<CreateVoiceAgent />} />
                  <Route path="/agents" element={<VoiceAgents />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/two-factor" element={<TwoFactorAuth />} />
                  <Route path="/login-activity" element={<LoginActivity />} />
                  <Route path="/account-settings" element={<AccountDeactivation />} />
                  <Route path="/inbound-numbers" element={<InboundNumbers />} />
                  <Route path="/call-schedules" element={<CallSchedules />} />
                  <Route path="/call-history" element={<CallHistory />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/knowledge-bases" element={<KnowledgeBases />} />
                  <Route path="/email" element={<Email />} />
                  <Route path="/ai-prompt" element={<AIPrompt />} />
                </Route>
              </Routes>
            </Router>
            </DialogProvider>
          </AuthProvider>
        </ThemeContextProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
