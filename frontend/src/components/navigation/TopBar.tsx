import { Link, useLocation } from 'react-router-dom';
import { BellIcon, MenuIcon, SearchIcon } from '../../assets/icons.tsx';
import { challanNewPath, getNavItem, paths } from '../../constants/navigation.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { useToast } from '../../hooks/useToast.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { Dropdown } from '../ui/Dropdown.tsx';
import { Input } from '../ui/Input.tsx';

interface TopBarProps {
  mobileNavOpen: boolean;
  onOpenNav: () => void;
}

interface Crumb {
  label: string;
  to?: string;
}

function crumbsFor(pathname: string, search: string): Crumb[] {
  const current = getNavItem(pathname);
  const moduleLabel = current?.label ?? 'Page';
  const params = new URLSearchParams(search);

  if (pathname === paths.dashboard) {
    return [{ label: 'Dashboard' }];
  }

  if (pathname === challanNewPath) {
    return [{ label: 'Sales Challans', to: paths.challans }, { label: 'New challan' }];
  }

  if (pathname.startsWith(`${paths.challans}/`) && pathname !== paths.challans) {
    return [
      { label: 'Sales Challans', to: paths.challans },
      { label: params.get('edit') === '1' ? 'Edit draft' : 'Challan' },
    ];
  }

  if (pathname.startsWith(`${paths.customers}/`) && pathname !== paths.customers) {
    return [{ label: 'Customers', to: paths.customers }, { label: 'Customer' }];
  }

  if (pathname.startsWith(`${paths.products}/`) && pathname !== paths.products) {
    return [{ label: 'Products', to: paths.products }, { label: 'Product' }];
  }

  return [{ label: moduleLabel }];
}

export function TopBar({ mobileNavOpen, onOpenNav }: TopBarProps) {
  const location = useLocation();
  const crumbs = crumbsFor(location.pathname, location.search);
  const { pushToast } = useToast();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          aria-label="Open navigation"
          aria-controls="mobile-navigation"
          aria-expanded={mobileNavOpen}
          onClick={onOpenNav}
        >
          <MenuIcon className="h-5 w-5" />
        </Button>

        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-2 text-sm">
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
                  {index > 0 ? (
                    <span className="text-ink-muted" aria-hidden="true">
                      /
                    </span>
                  ) : null}
                  {crumb.to && !last ? (
                    <Link to={crumb.to} className="truncate text-ink-muted hover:text-ink">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-ink" aria-current={last ? 'page' : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="ml-auto hidden min-w-0 max-w-xs flex-1 lg:block">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              pushToast({
                title: 'Search is not enabled yet',
                description: 'Global search will be wired in a later phase.',
                tone: 'info',
              });
            }}
          >
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                label="Search the workspace"
                hideLabel
                name="q"
                placeholder="Search customers, products, challans"
                className="border-line bg-canvas pl-9"
              />
            </div>
          </form>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
          <Dropdown
            label="Notifications"
            items={[
              {
                id: 'empty',
                label: 'No notifications yet',
                disabled: true,
                onSelect: () => undefined,
              },
            ]}
            trigger={
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-secondary hover:bg-canvas hover:text-ink">
                <BellIcon className="h-5 w-5" />
              </span>
            }
          />

          <Dropdown
            label="Account"
            items={[
              {
                id: 'logout',
                label: 'Sign out',
                onSelect: logout,
              },
            ]}
            trigger={
              <span className="ml-1 flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                <Badge tone="neutral">{user?.role ?? 'User'}</Badge>
                <span className="hidden max-w-36 truncate text-sm font-medium text-ink sm:inline">
                  {user?.name ?? 'Signed in'}
                </span>
              </span>
            }
          />
        </div>
      </div>
    </header>
  );
}
