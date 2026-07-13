import { getToken } from './auth';

const BASE = 'http://127.0.0.1:8000/api';

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function parseResponse(res) {
  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(data?.detail || data || `Request failed with ${res.status}`);
  }

  return data;
}

export async function register(payload) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(res);
}

export async function login(payload) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(res);
}

export async function getMe() {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  return parseResponse(res);
}

export async function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  return parseResponse(res);
}

export async function queryDocuments(question) {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question, k: 4 }),
  });
  return parseResponse(res);
}

export async function listDocuments() {
  const res = await fetch(`${BASE}/documents`, { headers: authHeaders() });
  return parseResponse(res);
}

export async function summarizeDocument(doc_id) {
  const res = await fetch(`${BASE}/documents/${doc_id}/summarize`, { method: 'POST', headers: authHeaders() });
  return parseResponse(res);
}

export async function getStudyNotes(doc_id) {
  const res = await fetch(`${BASE}/documents/${doc_id}/study-notes`, { headers: authHeaders() });
  return parseResponse(res);
}

export async function compareDocuments(document_a, document_b) {
  const res = await fetch(`${BASE}/documents/compare`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ document_a, document_b }),
  });
  return parseResponse(res);
}

export async function crossAnalysis(doc_ids = null) {
  const res = await fetch(`${BASE}/documents/cross-analysis`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ doc_ids }),
  });
  return parseResponse(res);
}

export async function getAnalytics() {
  const res = await fetch(`${BASE}/analytics`, { headers: authHeaders() });
  return parseResponse(res);
}

export async function getHistory() {
  const res = await fetch(`${BASE}/conversations`, { headers: authHeaders() });
  return parseResponse(res);
}

export async function clearHistory() {
  const res = await fetch(`${BASE}/conversations/clear`, { method: 'POST', headers: authHeaders() });
  return parseResponse(res);
}
