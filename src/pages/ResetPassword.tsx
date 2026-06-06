import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import AuthBackground from '../components/AuthBackground';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  const verified = location.state?.verified;

  useEffect(() => {
    if (!email || !verified) {
      // In a real app, you might redirect here
    }
  }, [email, verified]);

  if (!email || !verified) {
     return (
        <AuthBackground>
            <div className="w-full bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_20px_60px_-15px_rgba(30,64,175,0.25)] p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">Please verify your email first to reset your password.</p>
                <Link to="/forgot-password" className="text-healwin-600 font-medium hover:underline">
                    Go to Forgot Password
                </Link>
            </div>
        </AuthBackground>
     );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
    }

    if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
    }

    setLoading(true);
    // Mock API
    setTimeout(() => {
        setLoading(false);
        setSuccess(true);
        setTimeout(() => {
            navigate('/login');
        }, 2000);
    }, 1500);
  };

  return (
    <AuthBackground>
      <div className="w-full bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_20px_60px_-15px_rgba(30,64,175,0.25)] p-8 space-y-6">
        <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Reset Password</h1>
            <p className="text-sm text-gray-500 mt-2">Create a new strong password for your account</p>
        </div>

        {success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="flex justify-center mb-2">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-green-800 font-medium">Password Reset Successfully!</h3>
                <p className="text-green-600 text-sm mt-1">Redirecting to login...</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg flex items-start">
                        <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-healwin-500 pr-10"
                            placeholder="••••••••"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-healwin-500"
                        placeholder="••••••••"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-healwin-500 to-healwin-600 text-white rounded-lg text-lg font-medium hover:shadow-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
        )}
        
        {!success && (
            <div className="text-center">
                <Link to="/login" className="text-sm text-gray-600 hover:text-healwin-600 font-medium transition-colors">
                    Back to Login
                </Link>
            </div>
        )}
      </div>
    </AuthBackground>
  );
};

export default ResetPassword;
