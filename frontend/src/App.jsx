import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import Chat from './Chat';
import Summarize from './Summarize';
import StudyNotes from './StudyNotes';
import Compare from './Compare';
import CrossAnalysis from './CrossAnalysis';
import Analytics from './Analytics';
import History from './History';
import Login from './Login';
import { AuthProvider, useAuth } from './AuthContext';

function ProtectedApp() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background text-on-surface flex items-center justify-center">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<Chat />} />
        <Route path="summarize" element={<Summarize />} />
        <Route path="study-notes" element={<StudyNotes />} />
        <Route path="compare" element={<Compare />} />
        <Route path="cross-analysis" element={<CrossAnalysis />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="history" element={<History />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/chat' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="dark">
          <ProtectedApp />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
