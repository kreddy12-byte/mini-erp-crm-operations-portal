import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './components/feedback/Toast.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { AppRoutes } from './routes/AppRoutes.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
