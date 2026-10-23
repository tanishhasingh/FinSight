import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { userApi } from '../services/api';
import { CheckCircle2, AlertTriangle, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided. Please check the link in your email.');
      return;
    }

    const performVerification = async () => {
      try {
        setStatus('loading');
        const res = await userApi.verifyEmail(token);
        setStatus('success');
        setMessage(res.message || 'Your email has been verified successfully!');
        toast.success('Email verified successfully!');
      } catch (err: any) {
        setStatus('error');
        const errorMsg =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          'Verification failed or the link has expired.';
        setMessage(errorMsg);
      }
    };

    performVerification();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) {
      toast.error('Please enter your email address.');
      return;
    }

    try {
      setIsResending(true);
      const res = await userApi.resendVerification(resendEmail);
      setResendSuccess(true);
      toast.success(res.message || 'Verification link sent if account exists.');
    } catch (err: any) {
      toast.error('Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-md">
            F
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          FinSight Account Verification
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-100 dark:border-gray-700">
          {status === 'loading' && (
            <div className="text-center py-8 space-y-4">
              <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Verifying your email address, please wait...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Email Verified!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {message}
              </p>
              <div className="pt-4">
                <Link
                  to="/login"
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <span>Proceed to Login</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4 space-y-5">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Verification Issue
                </h3>
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-100 dark:border-red-900">
                  {message}
                </p>
              </div>

              {/* Resend verification box */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>Request a New Verification Link</span>
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Enter your registration email address to receive a fresh verification link.
                </p>

                {resendSuccess ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs">
                    If an unverified account with this email exists, a new link has been dispatched to your inbox.
                  </div>
                ) : (
                  <form onSubmit={handleResend} className="space-y-3">
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={isResending}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {isResending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Resend Verification Email</span>
                      )}
                    </button>
                  </form>
                )}
              </div>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs font-medium text-blue-600 hover:text-blue-500">
                  Return to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
