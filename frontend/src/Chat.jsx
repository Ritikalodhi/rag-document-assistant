import { useState, useRef, useEffect } from 'react';
import { queryDocuments, listDocuments } from './api';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [suggestions, setSuggestions] = useState(['Summarize the key findings', 'What are the limitations?', 'Extract methodology']);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text) {
    const q = text || input.trim();
    if (!q) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setThinking(true);
    try {
      const data = await queryDocuments(q);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: data.answer,
        sources: data.context || [],
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Error connecting to backend.', sources: [] }]);
    }
    setThinking(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8">
      <div className="max-w-[800px] mx-auto space-y-8 pb-64">

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center space-y-4">
            <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary-container text-[32px]" style={{fontVariationSettings:"'FILL' 1"}}>psychology</span>
            </div>
            <p className="text-on-surface-variant text-[16px]">Upload a document and start asking questions</p>
          </div>
        )}

        {messages.map((m, i) => m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] bg-[#1F1F23] text-on-surface px-6 py-4 rounded-2xl rounded-tr-none border border-white/5">
              <p>{m.content}</p>
            </div>
          </div>
        ) : (
          <div key={i} className="flex justify-start">
            <div className="max-w-[90%] w-full bg-[#18181B] border border-primary/20 p-6 rounded-2xl rounded-tl-none">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-primary" style={{fontVariationSettings:"'FILL' 1"}}>auto_awesome</span>
                </div>
                <span className="text-[12px] uppercase text-primary tracking-wider font-semibold">DocMind Insight</span>
              </div>
              <p className="text-on-surface/90 leading-relaxed whitespace-pre-wrap">{m.content}</p>

              {m.sources?.length > 0 && (
                <div className="mt-6 border-t border-outline-variant/20 pt-4">
                  <p className="text-[11px] uppercase text-on-surface-variant mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">menu_book</span>
                    Sources ({m.sources.length})
                  </p>
                  <div className="space-y-2">
                    {m.sources.map((s, j) => (
                      <div key={j} className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-primary text-[20px]">picture_as_pdf</span>
                          <div>
                            <p className="text-[14px] font-medium">{s.source || 'Document'}</p>
                            <p className="text-[12px] text-on-surface-variant">Page {s.page || '—'}</p>
                          </div>
                        </div>
                        {s.confidence_percent && (
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold border border-emerald-500/20">
                            {Math.round(s.confidence_percent)}% match
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-3 bg-[#18181B] px-4 py-3 rounded-full border border-primary/20">
              <div className="flex gap-1">
                {[0,0.2,0.4].map((d,i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-primary rounded-full thinking-indicator" style={{animationDelay:`${d}s`}} />
                ))}
              </div>
              <span className="text-[10px] text-primary/70 uppercase">DocMind is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 right-0 w-[calc(100%-280px)] p-8 pt-0 bg-gradient-to-t from-background via-background/90 to-transparent">
        <div className="max-w-[800px] mx-auto space-y-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)}
                className="px-4 py-2 bg-surface-container-high hover:bg-surface-variant border border-outline-variant/30 rounded-full text-[14px] text-on-surface-variant hover:text-on-surface transition-all">
                {s}
              </button>
            ))}
          </div>
          <div className="relative bg-[#232327] border border-outline-variant/30 rounded-[24px] p-2 flex items-end gap-2 focus-within:border-primary transition-all">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              placeholder="Ask anything about your docs..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface py-3 px-2 resize-none placeholder:text-on-surface-variant/40 outline-none"
              style={{maxHeight:'200px'}}
              onInput={e => { e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
            />
            <button onClick={() => send()}
              className="p-3 bg-primary-container text-on-primary-container rounded-xl hover:opacity-90 active:scale-95 transition-all">
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </div>
          <p className="text-center text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
            Enterprise RAG Engine • Secure Session
          </p>
        </div>
      </div>
    </div>
  );
}