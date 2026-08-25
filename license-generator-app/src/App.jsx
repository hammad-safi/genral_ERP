import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, Key, Copy, CheckCircle, Trash2 } from 'lucide-react';
import { importPrivateKey, signSystemId } from './utils/crypto';

export default function App() {
  const [privateKeyPem, setPrivateKeyPem] = useState(localStorage.getItem('licensePrivateKey') || '');
  const [cryptoKey, setCryptoKey] = useState(null);
  
  const [inputPem, setInputPem] = useState('');
  const [setupError, setSetupError] = useState('');
  
  const [systemId, setSystemId] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [generateError, setGenerateError] = useState('');
  const [copied, setCopied] = useState(false);

  // Initialize the Web Crypto key whenever the PEM string changes
  useEffect(() => {
    if (privateKeyPem) {
      importPrivateKey(privateKeyPem)
        .then(key => {
          setCryptoKey(key);
          localStorage.setItem('licensePrivateKey', privateKeyPem);
        })
        .catch(err => {
          console.error(err);
          setPrivateKeyPem('');
          localStorage.removeItem('licensePrivateKey');
          setSetupError('Failed to import the key. Make sure it is a valid PKCS8 PEM.');
        });
    } else {
      setCryptoKey(null);
    }
  }, [privateKeyPem]);

  const handleSetup = (e) => {
    e.preventDefault();
    setSetupError('');
    if (!inputPem.includes('BEGIN PRIVATE KEY')) {
      setSetupError('Invalid key format. Must include BEGIN PRIVATE KEY.');
      return;
    }
    setPrivateKeyPem(inputPem.trim());
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerateError('');
    setGeneratedKey('');
    
    if (!systemId.trim()) {
      setGenerateError('Please enter a System ID.');
      return;
    }
    
    if (!cryptoKey) {
      setGenerateError('Private key is not loaded properly.');
      return;
    }
    
    try {
      const signature = await signSystemId(cryptoKey, systemId.trim());
      setGeneratedKey(signature);
    } catch (err) {
      console.error(err);
      setGenerateError('An error occurred while generating the key.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearKey = () => {
    if (window.confirm('Are you sure you want to remove your private key from this browser?')) {
      setPrivateKeyPem('');
      setInputPem('');
      localStorage.removeItem('licensePrivateKey');
    }
  };

  if (!cryptoKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-2xl w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full">
              <ShieldAlert className="w-12 h-12 text-blue-600" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">Secure Setup Required</h1>
          <p className="text-center text-slate-600 mb-6">
            To generate licenses safely from the web, please provide your <code>private.pem</code> file contents.
            This key will <strong>never</strong> be sent to any server; it is stored locally in your browser.
          </p>
          
          <form onSubmit={handleSetup}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Paste your `private.pem` contents here
              </label>
              <textarea
                value={inputPem}
                onChange={e => setInputPem(e.target.value)}
                className="w-full h-48 bg-slate-50 border border-slate-300 rounded-lg p-4 font-mono text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIB...&#10;-----END PRIVATE KEY-----"
              />
            </div>
            
            {setupError && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {setupError}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
            >
              <KeyRound className="w-5 h-5 mr-2" />
              Save Key to Browser
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Key className="w-8 h-8 mr-3 text-blue-600" />
              License Key Generator
            </h1>
            <p className="text-slate-600 mt-1">Generate offline activation keys for your customers securely.</p>
          </div>
          <button
            onClick={handleClearKey}
            className="flex items-center text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Private Key
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
          <form onSubmit={handleGenerate}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Customer's System ID
              </label>
              <input
                type="text"
                value={systemId}
                onChange={e => setSystemId(e.target.value)}
                placeholder="e.g., e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-3 px-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {generateError && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {generateError}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors shadow-sm"
            >
              Generate Activation Key
            </button>
          </form>
        </div>

        {generatedKey && (
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-8 animate-fade-in-up">
            <h2 className="text-emerald-800 font-semibold mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Activation Key Generated Successfully!
            </h2>
            
            <div className="relative">
              <textarea
                readOnly
                value={generatedKey}
                className="w-full h-32 bg-white border border-emerald-200 rounded-lg p-4 font-mono text-sm text-slate-700 focus:outline-none resize-none"
              />
              <button
                onClick={handleCopy}
                className="absolute bottom-4 right-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors text-sm font-medium"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Key
                  </>
                )}
              </button>
            </div>
            
            <p className="text-emerald-700 text-sm mt-4">
              Send this key to your customer. They must paste this entire block into their software to activate it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
