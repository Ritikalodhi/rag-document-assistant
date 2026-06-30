import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  return (
    <div className="bg-background min-h-screen text-on-surface">
      <Sidebar />
      <Header />
      <main className="ml-[280px] mt-16 h-[calc(100vh-64px)] flex flex-col relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}