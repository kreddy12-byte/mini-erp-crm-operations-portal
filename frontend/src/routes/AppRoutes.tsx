import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.tsx';
import { AuthLayout } from '../layouts/AuthLayout.tsx';
import { ChallansPage } from '../pages/ChallansPage.tsx';
import { CrmPage } from '../pages/CrmPage.tsx';
import { CustomerDetailPage } from '../pages/CustomerDetailPage.tsx';
import { CustomersPage } from '../pages/CustomersPage.tsx';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.tsx';
import { InventoryPage } from '../pages/InventoryPage.tsx';
import { LoginPage } from '../pages/LoginPage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { ProductDetailPage } from '../pages/ProductDetailPage.tsx';
import { ProductsPage } from '../pages/ProductsPage.tsx';
import { ResetPasswordPage } from '../pages/ResetPasswordPage.tsx';
import { SignupPage } from '../pages/SignupPage.tsx';
import { VerifyEmailPage } from '../pages/VerifyEmailPage.tsx';
import { GuestRoute, ProtectedRoute } from './ProtectedRoute.tsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/challans" element={<ChallansPage />} />
          <Route path="/crm" element={<CrmPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
