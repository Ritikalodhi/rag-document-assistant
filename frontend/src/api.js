const BASE = 'http://127.0.0.1:8000/api';

export async function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file);  // must be 'file' not 'document'
  const res = await fetch('http://127.0.0.1:8000/api/upload', { 
    method: 'POST', 
    body: form 
    // NO Content-Type header — browser sets it automatically for FormData
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function queryDocuments(question) {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, k: 4 }),
  });
  return res.json();
}

export async function listDocuments() {
  const res = await fetch(`${BASE}/documents`);
  return res.json();
}

export async function summarizeDocument(doc_id) {
  const res = await fetch(`${BASE}/documents/${doc_id}/summarize`, { method: 'POST' });
  return res.json();
}

export async function getStudyNotes(doc_id) {
  const res = await fetch(`${BASE}/documents/${doc_id}/study-notes`);
  return res.json();
}

export async function compareDocuments(document_a, document_b) {
  const res = await fetch(`${BASE}/documents/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_a, document_b }),
  });
  return res.json();
}

export async function crossAnalysis(doc_ids = null) {
  const res = await fetch(`${BASE}/documents/cross-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_ids }),
  });
  return res.json();
}

export async function getAnalytics() {
  const res = await fetch(`${BASE}/analytics`);
  return res.json();
}

export async function getHistory() {
  const res = await fetch(`${BASE}/conversations`);
  return res.json();
}

export async function clearHistory() {
  const res = await fetch(`${BASE}/conversations/clear`, { method: 'POST' });
  return res.json();
}