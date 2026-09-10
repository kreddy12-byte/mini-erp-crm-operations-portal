import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.tsx';
import { AuthLayout } from '../layouts/AuthLayout.tsx';
import { ChallansPage } from '../pages/ChallansPage.tsx';
import { CrmPage } from '../pages/CrmPage.tsx';
import { CustomersPage } from '../pages/CustomersPage.tsx';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { InventoryPage } from '../pages/InventoryPage.tsx';
import { LoginPage } from '../pages/LoginPage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { ProductsPage } from '../pages/ProductsPage.tsx';
import { GuestRoute, ProtectedRoute } from './ProtectedRoute.tsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/challans" element={<ChallansPage />} />
          <Route path="/crm" element={<CrmPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
