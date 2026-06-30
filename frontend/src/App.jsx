import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import Chat from './Chat';
import Summarize from './Summarize';
import StudyNotes from './StudyNotes';
import Compare from './Compare';
import CrossAnalysis from './CrossAnalysis';
import Analytics from './Analytics';
import History from './History';

export default function App() {
  return (
    <BrowserRouter>
      <div className="dark">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="chat" element={<Chat />} />
            <Route path="summarize" element={<Summarize />} />
            <Route path="study-notes" element={<StudyNotes />} />
            <Route path="compare" element={<Compare />} />
            <Route path="cross-analysis" element={<CrossAnalysis />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="history" element={<History />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}