import { Link, useLocation } from 'react-router-dom';
import { BellIcon, MenuIcon, SearchIcon } from '../../assets/icons.tsx';
import { getNavItem, paths } from '../../constants/navigation.ts';
import { useToast } from '../../hooks/useToast.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { Dropdown } from '../ui/Dropdown.tsx';
import { Input } from '../ui/Input.tsx';

interface TopBarProps {
  mobileNavOpen: boolean;
  onOpenNav: () => void;
}

export function TopBar({ mobileNavOpen, onOpenNav }: TopBarProps) {
  const location = useLocation();
  const current = getNavItem(location.pathname);
  const { pushToast } = useToast();

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
          <ol className="flex items-center gap-2 text-sm">
            <li className="hidden text-ink-muted sm:block">Workspace</li>
            <li className="hidden text-ink-muted sm:block" aria-hidden="true">
              /
            </li>
            <li className="truncate font-medium text-ink" aria-current="page">
              {current?.label ?? 'Page'}
            </li>
          </ol>
        </nav>

        <div className="ml-auto hidden min-w-0 max-w-sm flex-1 md:block">
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
                className="pl-9"
              />
            </div>
          </form>
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
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

          <div className="ml-1 flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
            <Badge tone="neutral">Guest</Badge>
            <Link
              to={paths.login}
              className="text-sm font-medium text-ink hover:text-primary"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
