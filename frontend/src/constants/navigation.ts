import type { UserRole } from '../types/auth.ts';

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
  roles: UserRole[];
}

const ALL_ROLES: UserRole[] = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'];

export const NAV_ITEMS: NavItem[] = [
  { to: paths.dashboard, label: 'Dashboard', icon: 'dashboard', roles: ALL_ROLES },
  { to: paths.customers, label: 'Customers', icon: 'customers', roles: ALL_ROLES },
  { to: paths.products, label: 'Products', icon: 'products', roles: ALL_ROLES },
  { to: paths.inventory, label: 'Inventory', icon: 'inventory', roles: ALL_ROLES },
  { to: paths.challans, label: 'Sales Challans', icon: 'challans', roles: ALL_ROLES },
  { to: paths.crm, label: 'CRM / Follow-ups', icon: 'crm', roles: ALL_ROLES },
];

export function getNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.to === pathname);
}

export function navItemsForRole(role: UserRole): NavItem[] {
  // Every current item lists all roles, so nothing is hidden yet.
  // Later phases can narrow item.roles. Backend RBAC remains authoritative.
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
