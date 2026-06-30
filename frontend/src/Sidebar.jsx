import { NavLink } from 'react-router-dom';
import { uploadDocument } from './api';

const links = [
  { to: '/chat', icon: 'chat', label: 'Chat' },
  { to: '/summarize', icon: 'summarize', label: 'Summarize' },
  { to: '/study-notes', icon: 'edit_note', label: 'Study Notes' },
  { to: '/compare', icon: 'compare_arrows', label: 'Compare' },
  { to: '/cross-analysis', icon: 'analytics', label: 'Cross Analysis' },
  { to: '/analytics', icon: 'insert_chart', label: 'Analytics' },
  { to: '/history', icon: 'history', label: 'History' },
];

export default function Sidebar() {
  async function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = await uploadDocument(file);
    alert(data.message || 'Uploaded!');
  } catch(err) {
    alert('Upload failed: ' + err.message);
  }
}

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-surface-container-low border-r border-outline-variant/30 flex flex-col z-50">
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary-container" style={{fontVariationSettings:"'FILL' 1"}}>psychology</span>
        </div>
        <div>
          <h1 className="text-[20px] font-semibold text-on-surface">DocMind AI</h1>
          <p className="text-[10px] text-primary/70 tracking-widest uppercase">LLM Assistant</p>
        </div>
      </div>

      <div className="px-4 mt-4">
        <label className="w-full py-3 px-4 bg-primary text-on-primary font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">upload_file</span>
          Upload Document
          <input type="file" className="hidden" accept=".pdf,.txt,.docx" onChange={handleUpload} />
        </label>
      </div>

      <nav className="flex-1 px-3 mt-6 space-y-1 overflow-y-auto custom-scrollbar">
        {links.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer text-[12px] font-semibold uppercase tracking-wider ` +
            (isActive ? 'text-primary bg-primary/5 border-l-4 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5')
          }>
            <span className="material-symbols-outlined">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-outline-variant/20">
        <div className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
          <span className="text-[11px] uppercase tracking-wider">User Profile</span>
        </div>
      </div>
    </aside>
  );
}