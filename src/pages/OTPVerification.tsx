import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import AuthBackground from '../components/AuthBackground';

const OTPVerification = () => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    
    // Mock API verification
    setTimeout(() => {
      setLoading(false);
      if (otp === '123456') {
        navigate('/reset-password', { state: { email, verified: true } });
      } else {
        setError('Invalid OTP. Please try again.');
      }
    }, 1500);
  };

  return (
    <AuthBackground>
      <div className="w-full bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_20px_60px_-15px_rgba(30,64,175,0.25)] p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Verify OTP</h1>
          <p className="text-sm text-gray-500 mt-2">
            Enter the 6-digit code sent to <span className="font-medium text-gray-700">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">One-Time Password</label>
            <input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(value);
                setError('');
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-healwin-500 text-center text-2xl tracking-widest font-mono"
              maxLength={6}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2 text-center">Demo OTP: 123456</p>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-3 bg-gradient-to-r from-healwin-500 to-healwin-600 text-white rounded-lg text-lg font-medium hover:shadow-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <div className="flex flex-col items-center space-y-4 text-sm">
          <p className="text-gray-600">
            Didn't receive the code?{' '}
            <button className="text-healwin-600 hover:text-healwin-700 font-medium">
              Resend
            </button>
          </p>
          
          <Link
            to="/login"
            className="inline-flex items-center text-gray-600 hover:text-healwin-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Link>
        </div>
      </div>
    </AuthBackground>
  );
};

export default OTPVerification;
