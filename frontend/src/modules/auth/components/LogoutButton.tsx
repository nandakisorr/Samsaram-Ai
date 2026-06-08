import { useLogout } from '../hooks/useAuth';
import styles from './LogoutButton.module.css';

interface LogoutButtonProps {
  onLogoutSuccess?: () => void;
  variant?: 'button' | 'link';
}

export function LogoutButton({ onLogoutSuccess, variant = 'button' }: LogoutButtonProps) {
  const logout = useLogout();

  const handleLogout = async () => {
    try {
      await logout();
      onLogoutSuccess?.();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (variant === 'link') {
    return (
      <button onClick={handleLogout} className={styles.link}>
        Logout
      </button>
    );
  }

  return (
    <button onClick={handleLogout} className={styles.button}>
      Logout
    </button>
  );
}
