import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar.tsx';
import { TopBar } from '../components/navigation/TopBar.tsx';
import { RouteTransition } from '../components/navigation/RouteTransition.tsx';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-svh bg-canvas">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-60">
        <TopBar mobileNavOpen={mobileOpen} onOpenNav={() => setMobileOpen(true)} />
        <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="page-frame">
            <RouteTransition>
              <Outlet />
            </RouteTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
