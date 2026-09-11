import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, Layers } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

interface DemoCredential {
  role: UserRole;
  name: string;
  email: string;
  pass: string;
  scope: string;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts: DemoCredential[] = [
    {
      role: 'Admin',
      name: 'Sarah Connor',
      email: 'admin@portal.com',
      pass: 'Admin@123',
      scope: 'Full System & Operations Access',
    },
    {
      role: 'Sales',
      name: 'Alex Mercer',
      email: 'sales@portal.com',
      pass: 'Sales@123',
      scope: 'Customer CRM & Sales Challans',
    },
    {
      role: 'Warehouse',
      name: 'Marcus Vance',
      email: 'warehouse@portal.com',
      pass: 'Warehouse@123',
      scope: 'Inventory, Stock Inward & Dispatch',
    },
    {
      role: 'Accounts',
      name: 'Elena Rostova',
      email: 'accounts@portal.com',
      pass: 'Accounts@123',
      scope: 'Challan Invoicing & Financial Audits',
    },
  ];

  const handleSelectDemo = (account: DemoCredential) => {
    setEmail(account.email);
    setPassword(account.pass);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const response = await api.login(email.trim(), password);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e6ecf4] flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl neu-flat text-indigo-600 mb-2 border border-white/80 shadow-md">
            <Layers className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Operations Portal
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Mini ERP + CRM Portal • Secure PostgreSQL & JWT Authentication
          </p>
        </div>

        {/* Login Card */}
        <div className="neu-flat p-6 sm:p-8 rounded-3xl border border-white/80 shadow-xl space-y-6">
          <div className="border-b border-slate-300/70 pb-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>User Sign In</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your corporate credentials to access portal features.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-100/90 border border-rose-300 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Authentication Failed</p>
                <p className="text-rose-700">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-email">
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="name@portal.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full neu-input pl-10 pr-3.5 py-2.5 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-password">
                Account Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full neu-input pl-10 pr-10 py-2.5 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl neu-accent-btn text-xs font-bold shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating with Database...</span>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Test Users */}
          <div className="pt-3 border-t border-slate-300/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Evaluation Test Credentials
              </span>
              <span className="text-[10px] text-indigo-600 font-medium">Click to fill</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  id={`demo-user-${acc.role.toLowerCase()}`}
                  type="button"
                  onClick={() => handleSelectDemo(acc)}
                  className={`p-2.5 rounded-xl text-left transition-all text-xs border ${
                    email === acc.email
                      ? 'neu-pressed border-indigo-400/50 bg-[#e0e7f2]'
                      : 'neu-button border-white/60 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{acc.role}</span>
                    <span className="text-[10px] text-slate-400 font-mono">1-click</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{acc.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security & System Info Footer */}
        <div className="text-center text-[11px] text-slate-400 space-y-1">
          <p>Passwords stored as salted bcrypt hashes in PostgreSQL.</p>
          <p>Protected by stateless JSON Web Tokens with server-side RBAC validation.</p>
        </div>
      </div>
    </div>
  );
}
