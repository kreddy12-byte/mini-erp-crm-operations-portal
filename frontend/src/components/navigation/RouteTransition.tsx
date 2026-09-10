import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="animate-route-in">
      {children}
    </div>
  );
}
