import React, { useState, useRef, useEffect } from 'react';
import { useLogin, useRegister, useRequestPasswordReset, useVerifyResetToken, useResetPassword } from '../hooks/useAuth';
import { LoginCredentials, RegisterCredentials, ForgotPasswordCredentials, ResetPasswordCredentials } from '../types';
import { useNavigate } from 'react-router-dom';
import styles from './AuthForm.module.css';

interface AuthFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function LoginForm({ onSuccess, onError }: AuthFormProps) {
  const login = useLogin();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<LoginCredentials>({
    username: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const isSubmittingRef = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsLoading(true);
    setError('');

    try {
      await login(formData);
      onSuccess?.();
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.detail || err.message || 'Login failed';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

   return (
     <div className={styles.container}>
       <form onSubmit={handleSubmit} className={styles.form}>
         <h2>Login</h2>

         {error && <div className={styles.error}>{error}</div>}

         <div className={styles.field}>
           <label htmlFor="username">Username</label>
           <input
             type="text"
             id="username"
             name="username"
             value={formData.username}
             onChange={handleChange}
             required
             disabled={isLoading}
           />
         </div>

         <div className={styles.field}>
           <label htmlFor="password">Password</label>
           <input
             type="password"
             id="password"
             name="password"
             value={formData.password}
             onChange={handleChange}
             required
             disabled={isLoading}
           />
         </div>

         <button type="submit" disabled={isLoading} className={styles.submitBtn}>
           {isLoading ? 'Logging in...' : 'Login'}
         </button>

         <div className={styles.forgotPasswordLink}>
           <button 
             type="button"
             onClick={() => navigate('/forgot-password')}
             className={styles.linkButton}
           >
             Forgot Password?
           </button>
         </div>
       </form>
     </div>
   );
 }

export function RegisterForm({ onSuccess, onError }: AuthFormProps) {
   const register = useRegister();
   const navigate = useNavigate();
   const [isLoading, setIsLoading] = useState(false);
   const [formData, setFormData] = useState<RegisterCredentials>({
     username: '',
     email: '',
     password: '',
     dateOfBirth: '',
     confirmPassword: '',
   });
   const [error, setError] = useState<string>('');
   const [success, setSuccess] = useState<string>('');
   const [validationErrors, setValidationErrors] = useState<{
     password?: string;
     confirmPassword?: string;
   }>({});
   const isSubmittingRef = useRef(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Real-time validation
    if (name === 'password') {
      const passwordError = validatePassword(value);
      setValidationErrors(prev => ({ ...prev, password: passwordError || undefined }));
      // Also revalidate confirm password if it exists
      if (formData.confirmPassword) {
        if (value !== formData.confirmPassword) {
          setValidationErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
        } else {
          setValidationErrors(prev => ({ ...prev, confirmPassword: undefined }));
        }
      }
    }

    if (name === 'confirmPassword') {
      if (value !== formData.password) {
        setValidationErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else {
        setValidationErrors(prev => ({ ...prev, confirmPassword: undefined }));
      }
    }
  };

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (isSubmittingRef.current) return;

     // Validate password
     const passwordError = validatePassword(formData.password);
     if (passwordError) {
       setValidationErrors(prev => ({ ...prev, password: passwordError }));
       return;
     }

     // Validate confirm password
     if (formData.password !== formData.confirmPassword) {
       setValidationErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
       return;
     }

     isSubmittingRef.current = true;
     setIsLoading(true);
     setError('');
     setSuccess('');
     setValidationErrors({});

     try {
       await register(formData);
       setSuccess('Account created successfully! Redirecting...');
       onSuccess?.();
       setTimeout(() => navigate('/'), 3000);
     } catch (err: any) {
       const errorMessage = err.detail || err.message || 'Registration failed';
       setError(errorMessage);
       onError?.(new Error(errorMessage));
     } finally {
       setIsLoading(false);
       isSubmittingRef.current = false;
     }
   };

    return (
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2>Register</h2>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

         <div className={styles.field}>
           <label htmlFor="username">Username</label>
           <input
             type="text"
             id="username"
             name="username"
             value={formData.username}
             onChange={handleChange}
             required
             disabled={isLoading}
           />
         </div>

         <div className={styles.field}>
           <label htmlFor="email">Email</label>
           <input
             type="email"
             id="email"
             name="email"
             value={formData.email}
             onChange={handleChange}
             required
             disabled={isLoading}
           />
         </div>

         <div className={styles.field}>
           <label htmlFor="dateOfBirth">Date of Birth</label>
           <input
             type="date"
             id="dateOfBirth"
             name="dateOfBirth"
             value={formData.dateOfBirth}
             onChange={handleChange}
             disabled={isLoading}
           />
         </div>

         <div className={styles.field}>
           <label htmlFor="password">Password</label>
           <input
             type="password"
             id="password"
             name="password"
             value={formData.password}
             onChange={handleChange}
             required
             disabled={isLoading}
           />
           {validationErrors.password && (
             <div className={styles.validationError}>{validationErrors.password}</div>
           )}
         </div>

         <div className={styles.field}>
           <label htmlFor="confirmPassword">Confirm Password</label>
           <input
             type="password"
             id="confirmPassword"
             name="confirmPassword"
             value={formData.confirmPassword}
             onChange={handleChange}
             required
             disabled={isLoading}
           />
           {validationErrors.confirmPassword && (
             <div className={styles.validationError}>{validationErrors.confirmPassword}</div>
           )}
         </div>

          <button type="submit" disabled={isLoading} className={styles.submitBtn}>
            {isLoading ? 'Creating account...' : 'Register'}
          </button>
        </form>
      </div>
    );
  }

  // Forgot Password Form
  export function ForgotPasswordForm() {
    const requestPasswordReset = useRequestPasswordReset();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<ForgotPasswordCredentials>({
      email: '',
    });
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');
      setSuccess('');

      try {
        const result = await requestPasswordReset(formData.email);
        setSuccess(result.message);
        // Redirect to login after 3 seconds
        setTimeout(() => navigate('/login'), 3000);
      } catch (err: any) {
        const errorMessage = err.detail || err.message || 'Request failed';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2>Forgot Password</h2>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <div className={styles.field}>
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading}
              placeholder="Enter your registered email"
            />
          </div>

          <button type="submit" disabled={isLoading} className={styles.submitBtn}>
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <div className={styles.forgotPasswordLink}>
            <button 
              type="button"
              onClick={() => navigate('/login')}
              className={styles.linkButton}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Reset Password Form
  export function ResetPasswordForm() {
    const resetPassword = useResetPassword();
    const verifyToken = useVerifyResetToken();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [isVerifying, setIsVerifying] = useState(true);

    // Get token from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || '';

    const [formData, setFormData] = useState<ResetPasswordCredentials & { new_password: string; confirm_password: string }>({
      token,
      new_password: '',
      confirm_password: '',
    });
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');

    // Verify token on mount
    React.useEffect(() => {
      const checkToken = async () => {
        if (!token) {
          setTokenValid(false);
          setIsVerifying(false);
          return;
        }
        try {
          const result = await verifyToken(token);
          setTokenValid(result.valid);
        } catch (err: any) {
          setTokenValid(false);
        } finally {
          setIsVerifying(false);
        }
      };
      checkToken();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.new_password || !formData.confirm_password) {
        setError('Please fill in all fields');
        return;
      }
      if (formData.new_password !== formData.confirm_password) {
        setError('Passwords do not match');
        return;
      }
      setIsLoading(true);
      setError('');
      setSuccess('');

      try {
        const result = await resetPassword(token, formData.new_password, formData.confirm_password);
        setSuccess(result.message || 'Password reset successfully!');
        setTimeout(() => navigate('/login'), 3000);
      } catch (err: any) {
        const errorMessage = err.detail || err.message || 'Reset failed';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (isVerifying) {
      return (
        <div className={styles.container}>
          <div className={styles.form}>
            <p>Verifying reset token...</p>
          </div>
        </div>
      );
    }

    if (tokenValid === false) {
      return (
        <div className={styles.container}>
          <div className={styles.form}>
            <h2>Invalid or Expired Token</h2>
            <p className={styles.error}>The password reset link is invalid or has expired.</p>
            <button 
              onClick={() => navigate('/forgot-password')}
              className={styles.submitBtn}
            >
              Request New Reset Link
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2>Reset Password</h2>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <div className={styles.field}>
            <label htmlFor="new_password">New Password</label>
            <input
              type="password"
              id="new_password"
              name="new_password"
              value={formData.new_password}
              onChange={handleChange}
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirm_password">Confirm New Password</label>
            <input
              type="password"
              id="confirm_password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <button type="submit" disabled={isLoading} className={styles.submitBtn}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    );
  }
