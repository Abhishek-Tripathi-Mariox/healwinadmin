import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import AuthBackground from '../components/AuthBackground';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email is required');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    // Mock API call
    setTimeout(() => {
      setLoading(false);
      // Navigate to OTP verification instead of showing success message here
      navigate('/otp-verification', { state: { email } });
    }, 1500);
  };

  return (
    <AuthBackground>
      <div className="w-full bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_20px_60px_-15px_rgba(30,64,175,0.25)] p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">
            Forgot Password
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Enter your email to receive a password reset link
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-healwin-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-healwin-500 to-healwin-600 text-white rounded-lg text-lg font-medium hover:shadow-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-sm text-gray-600 hover:text-healwin-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Link>
        </div>
      </div>
    </AuthBackground>
  );
};

export default ForgotPassword;
