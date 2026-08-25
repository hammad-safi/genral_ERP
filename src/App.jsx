import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { BusinessProvider, useBusiness } from '@/contexts/BusinessContext';
import Navbar from '@/components/Navbar';
import ActivationScreen from '@/pages/ActivationScreen';
import './App.css';

// Lazy load all pages for code splitting and reduced initial bundle
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Products = lazy(() => import('@/pages/Products'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const Sales = lazy(() => import('@/pages/Sales'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const Customers = lazy(() => import('@/pages/Customers'));
const CustomerDetail = lazy(() => import('@/pages/CustomerDetail'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const MonthlyRecords = lazy(() => import('@/pages/MonthlyRecords'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-slate-600">Loading...</p>
    </div>
  </div>
);

// Wrapper component to handle routing
function BusinessRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/monthly-records" element={<MonthlyRecords />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const [licenseStatus, setLicenseStatus] = useState({ isLicensed: false, isTrialValid: false, trialDaysLeft: 0 });
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);

  useEffect(() => {
    const checkLicense = async () => {
      try {
        if (window.electronAPI?.checkLicense) {
          const status = await window.electronAPI.checkLicense();
          setLicenseStatus(status);
        } else {
          // If running in browser without electron, you might want to skip or simulate
          setLicenseStatus({ isLicensed: true, isTrialValid: false, trialDaysLeft: 0 }); 
        }
      } catch (err) {
        console.error('License check failed:', err);
      } finally {
        setIsCheckingLicense(false);
      }
    };
    checkLicense();
  }, []);

  if (isCheckingLicense) {
    return <LoadingFallback />;
  }

  if (!licenseStatus.isLicensed) {
    return (
      <ActivationScreen 
        onActivated={() => setLicenseStatus({ ...licenseStatus, isLicensed: true })} 
        licenseStatus={licenseStatus}
        onContinueTrial={() => setLicenseStatus({ ...licenseStatus, isLicensed: true, isUsingTrial: true })}
      />
    );
  }

  return (
    <BusinessProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="flex min-h-screen bg-slate-50">
          <Navbar />
          <main className="flex-1">
            {licenseStatus.isUsingTrial && (
              <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-3 mb-4 rounded shadow-sm flex justify-between items-center">
                <p>
                  <strong className="font-bold">Trial Mode Active.</strong> You have {licenseStatus.trialDaysLeft} day(s) left in your trial. 
                </p>
                <button 
                  onClick={() => setLicenseStatus({...licenseStatus, isLicensed: false})} 
                  className="text-amber-800 underline text-sm hover:text-amber-900"
                >
                  Enter Activation Key
                </button>
              </div>
            )}
            <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <BusinessRoutes />
            </div>
          </main>
        </div>
      </Router>
    </BusinessProvider>
  );
}

export default App;
