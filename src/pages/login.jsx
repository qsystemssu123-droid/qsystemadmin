import { useState } from 'react';
import ssuBG from '../assets/ssuBG.png';
import LoginBranding from '../components/login/LoginBranding.jsx';
import LoginError from '../components/login/LoginError.jsx';
import StaffLoginForm from '../components/login/StaffLoginForm.jsx';
import AdminLoginButton from '../components/login/AdminLoginButton.jsx';
import {
  handleGoogleLogin as loginWithGoogle,
  handleStaffEmailLogin as loginStaff
} from '../services/loginService.js';

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [office, setOffice] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const user = await loginWithGoogle();

      if (onLogin) {
        onLogin({
          ...user,
          role: 'admin'
        });
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);

      setErrorMessage(
        error?.message || "You're not authorized to login"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStaffEmailLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!office) {
      setErrorMessage('Please select an office before signing in.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const user = await loginStaff({
        email,
        password,
        office
      });

      if (onLogin) {
        onLogin({
          ...user,
          office: user.office || office,
          role: 'staff'
        });
      }
    } catch (error) {
      console.error(
        'Staff Login Error Code & Message:',
        error?.code,
        error?.message
      );

      setErrorMessage(
        error?.message ||
          'Invalid email, password, or office selection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-screen items-center justify-center px-4 py-8 relative overflow-hidden font-sans box-border bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${ssuBG})` }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"></div>

      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/25 space-y-6 text-center relative z-10 transition-all box-border">
        <LoginBranding />

        <LoginError errorMessage={errorMessage} />

        <StaffLoginForm
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          office={office}
          setOffice={setOffice}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          loading={loading}
          onSubmit={handleStaffEmailLogin}
        />

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200"></div>

          <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium uppercase">
            Or Admin Access
          </span>

          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <AdminLoginButton
          loading={loading}
          email={email}
          onClick={handleGoogleLogin}
        />

        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] font-medium text-slate-400">
            Authorized Personnel Only • Samar State University SSU
          </p>
        </div>
      </div>
    </div>
  );
}