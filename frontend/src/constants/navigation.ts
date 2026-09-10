export const paths = {
  login: '/login',
  dashboard: '/dashboard',
  customers: '/customers',
  products: '/products',
  inventory: '/inventory',
  challans: '/challans',
  crm: '/crm',
} as const;

export type AppPath = (typeof paths)[keyof typeof paths];

export interface NavItem {
  to: AppPath;
  label: string;
  icon: 'dashboard' | 'customers' | 'products' | 'inventory' | 'challans' | 'crm';
}

export const NAV_ITEMS: NavItem[] = [
  { to: paths.dashboard, label: 'Dashboard', icon: 'dashboard' },
  { to: paths.customers, label: 'Customers', icon: 'customers' },
  { to: paths.products, label: 'Products', icon: 'products' },
  { to: paths.inventory, label: 'Inventory', icon: 'inventory' },
  { to: paths.challans, label: 'Sales Challans', icon: 'challans' },
  { to: paths.crm, label: 'CRM / Follow-ups', icon: 'crm' },
];

export function getNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.to === pathname);
}
