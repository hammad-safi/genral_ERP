import React, { useState, useEffect } from 'react';
import { Shield, Key, Copy, CheckCircle, Clock } from 'lucide-react';

export default function ActivationScreen({ onActivated, licenseStatus, onContinueTrial }) {
  const [systemId, setSystemId] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Get the System ID from the main process
    if (window.electronAPI?.getSystemId) {
      window.electronAPI.getSystemId().then(id => {
        setSystemId(id);
      }).catch(err => {
        console.error('Failed to get System ID:', err);
        setSystemId('Error generating System ID');
      });
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(systemId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!activationKey.trim()) {
      setError('Please enter an activation key');
      return;
    }

    setLoading(true);
    try {
      if (window.electronAPI?.activateLicense) {
        const result = await window.electronAPI.activateLicense(activationKey.trim());
        if (result.success) {
          onActivated();
        } else {
          setError(result.message || 'Invalid activation key');
        }
      } else {
        setError('License verification system not found');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during activation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 p-4 rounded-full">
            <Shield className="w-12 h-12 text-blue-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Software Activation Required</h1>
        <p className="text-center text-slate-600 mb-8">
          Please provide your System ID to the software vendor to receive your Activation Key.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Your System ID
          </label>
          <div className="flex">
            <input
              type="text"
              readOnly
              value={systemId}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-l-lg py-2 px-3 text-slate-600 font-mono text-sm focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="bg-slate-200 hover:bg-slate-300 border border-l-0 border-slate-300 rounded-r-lg px-4 flex items-center justify-center transition-colors"
              title="Copy System ID"
            >
              {copied ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </div>

        <form onSubmit={handleActivate}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Activation Key
            </label>
            <textarea
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
              placeholder="Paste your activation key here..."
              className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm min-h-[100px]"
            />
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Key className="w-5 h-5 mr-2" />
                Activate Software
              </>
            )}
          </button>
        </form>

        {licenseStatus?.isTrialValid && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-center text-sm text-slate-600 mb-4">
              Or continue evaluating the software. You have <strong>{licenseStatus.trialDaysLeft}</strong> day(s) left.
            </p>
            <button
              onClick={onContinueTrial}
              className="w-full bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700 font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
            >
              <Clock className="w-5 h-5 mr-2 text-slate-500" />
              Continue Trial
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
