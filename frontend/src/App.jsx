import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [stats, setStats] = useState(null);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats`);
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await axios.post(`${API_BASE_URL}/upload`, formData);
      alert(`Successfully uploaded ${res.data.filename}`);
      setUploadFile(null);
      fetchStats();
    } catch (error) {
      alert(`Error uploading file: ${error.response?.data?.detail || error.message}`);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/query`, { question });
      setResponse(res.data);
    } catch (error) {
      alert(`Error querying: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="header">
        <h1>📚 RAG Document Assistant</h1>
        <p>Ask questions about your documents</p>
      </header>

      <main className="container">
        <div className="stats-panel">
          {stats && (
            <div>
              <h3>📊 Status</h3>
              <p>Documents indexed: <strong>{stats.document_count}</strong></p>
              <p>Collection: <strong>{stats.collection_name}</strong></p>
            </div>
          )}
        </div>

        <div className="upload-panel">
          <h3>📤 Upload Document</h3>
          <form onSubmit={handleUpload}>
            <input
              type="file"
              accept=".pdf,.txt,.docx,.md"
              onChange={(e) => setUploadFile(e.target.files?.[0])}
              disabled={uploadLoading}
            />
            <button type="submit" disabled={!uploadFile || uploadLoading}>
              {uploadLoading ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </div>

        <div className="query-panel">
          <h3>🔍 Ask a Question</h3>
          <form onSubmit={handleQuery}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to know about your documents?"
              rows="3"
              disabled={loading}
            />
            <button type="submit" disabled={!question.trim() || loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {response && (
          <div className="response-panel">
            <h3>💡 Answer</h3>
            <p>{response.answer}</p>
            {response.context && response.context.length > 0 && (
              <div className="sources">
                <h4>📚 Sources ({response.context.length})</h4>
                {response.context.map((ctx, idx) => (
                  <div key={idx} className="source">
                    <p><strong>Source {idx + 1}:</strong> {ctx.source}</p>
                    <p>{ctx.content.substring(0, 200)}...</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
