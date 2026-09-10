import { NavLink } from 'react-router-dom';
import {
  ChallansIcon,
  CloseIcon,
  CrmIcon,
  CustomersIcon,
  DashboardIcon,
  InventoryIcon,
  ProductsIcon,
} from '../../assets/icons.tsx';
import { APP_NAME, APP_PRODUCT } from '../../constants/app.ts';
import { NAV_ITEMS, type NavItem } from '../../constants/navigation.ts';
import { cn } from '../../utils/cn.ts';
import { Button } from '../ui/Button.tsx';

const icons = {
  dashboard: DashboardIcon,
  customers: CustomersIcon,
  products: ProductsIcon,
  inventory: InventoryIcon,
  challans: ChallansIcon,
  crm: CrmIcon,
} as const;

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-1">
      <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{APP_NAME}</p>
        <p className="truncate text-caption">{APP_PRODUCT}</p>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <li key={item.to}>
          <NavItemLink item={item} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = icons[item.icon];

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary-muted text-primary'
            : 'text-ink-secondary hover:bg-canvas hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
          {isActive ? <span className="sr-only">(current page)</span> : null}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
        <div className="border-b border-line px-3 py-4">
          <Brand />
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
          <NavList />
        </nav>
        <p className="px-6 py-4 text-caption">Phase 1 foundation</p>
      </aside>

      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <button
          type="button"
          aria-label="Close navigation"
          className={cn(
            'absolute inset-0 bg-ink/40 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onClose}
          tabIndex={mobileOpen ? 0 : -1}
        />
        <div
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Main navigation"
          aria-hidden={!mobileOpen}
          inert={!mobileOpen}
          className={cn(
            'absolute inset-y-0 left-0 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col bg-surface shadow-md transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-3">
            <Brand />
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close navigation">
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
          <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
            <NavList onNavigate={onClose} />
          </nav>
        </div>
      </div>
    </>
  );
}
