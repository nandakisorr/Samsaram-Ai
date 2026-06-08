import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from '@/core/providers/AuthProvider';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) {
  console.error('Root element not found');
} else {
  ReactDOM.createRoot(root).render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  console.log('React mounted');
}
