import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { BusinessProvider, useBusiness } from '@/contexts/BusinessContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import TopGlobalBar from '@/components/TopGlobalBar';
import ActivationScreen from '@/pages/ActivationScreen';
import './App.css';
// Lazy load all pages for code splitting and reduced initial bundle
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Products = lazy(() => import('@/pages/Products'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const POS = lazy(() => import('@/pages/POS'));
const Sales = lazy(() => import('@/pages/Sales'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const SupplierDetail = lazy(() => import('@/pages/SupplierDetail'));
const Customers = lazy(() => import('@/pages/Customers'));
const CustomerDetail = lazy(() => import('@/pages/CustomerDetail'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const MonthlyRecords = lazy(() => import('@/pages/MonthlyRecords'));
const Categories = lazy(() => import('@/pages/Categories'));
const Login = lazy(() => import('@/pages/Login'));

const UsersAndRoles = lazy(() => import('@/pages/UsersAndRoles'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-slate-600">Loading...</p>
    </div>
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children, module, action = 'View' }) => {
  const { user, loading, hasPermission } = useAuth();
  
  if (loading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;
  
  if (module && !hasPermission(module, action)) {
    // If they don't have access to this module, fallback to a safe route
    if (user.permissions?.POS?.View) return <Navigate to="/pos" replace />;
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Wrapper component to handle routing
function BusinessRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute module="Dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute module="Products"><Products /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute module="Categories"><Categories /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute module="Inventory"><Inventory /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute module="POS"><POS /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute module="Sales"><Sales /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute module="Purchases"><Purchases /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute module="Suppliers"><Suppliers /></ProtectedRoute>} />
        <Route path="/suppliers/:id" element={<ProtectedRoute module="Suppliers"><SupplierDetail /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute module="Customers"><Customers /></ProtectedRoute>} />
        <Route path="/customers/:id" element={<ProtectedRoute module="Customers"><CustomerDetail /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute module="Expenses"><Expenses /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute module="Reports"><Reports /></ProtectedRoute>} />
        <Route path="/monthly-records" element={<ProtectedRoute module="Monthly Records"><MonthlyRecords /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute module="Settings"><Settings /></ProtectedRoute>} />
        <Route path="/users-roles" element={<ProtectedRoute module="Users"><UsersAndRoles /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}



function App() {

  const [licenseStatus, setLicenseStatus] = useState({ isLicensed: false, isTrialValid: false, trialDaysLeft: 0 });
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);

  useEffect(() => {
    

    if (window.electronAPI?.onSyncReceive) {
      window.electronAPI.onSyncReceive(async (reqId, ops) => {
        try {
          if (ops && ops.length > 0) {
            window.isApplyingSync = true;
            for (const op of ops) {
              
              if (!table) continue;
              if (op.action === 'creating' || op.action === 'updating') {
                await table.put(op.data);
              } else if (op.action === 'deleting') {
                await table.delete(op.key);
              }
            }
            window.isApplyingSync = false;
          }
          
          const localOps = [];
          const localIds = localOps.map(i => i.id);
          
          window.electronAPI.replySync(reqId, localOps);
          
          if (localIds.length > 0) {
            
          }
        } catch (err) {
          console.error('Error applying sync:', err);
          window.isApplyingSync = false;
          window.electronAPI.replySync(reqId, []);
        }
      });
    }
  }, []);

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

const AppLayout = ({ licenseStatus, setLicenseStatus }) => {
  const location = useLocation();
  const isPOS = location.pathname === '/pos';
  const isLogin = location.pathname === '/login';

  return (
    <div className="flex min-h-screen bg-[#F4F7FC] overflow-hidden">
      {!isLogin && <Navbar />}
      <main className="flex-1 min-w-0 h-screen flex flex-col relative bg-[#F4F7FC]">
        {licenseStatus.isUsingTrial && !isLogin && (
          <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-3 shrink-0 shadow-sm flex justify-between items-center">
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
        {!isLogin && <TopGlobalBar />}
        <div className={(isLogin ? "w-full h-full" : (isPOS ? "w-full h-full flex-1" : "w-full px-4 sm:px-6 lg:px-8 py-6 flex-1")) + " overflow-y-auto"}>
          <BusinessRoutes />
        </div>
      </main>
    </div>
  );
};

  return (
    <BusinessProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppLayout licenseStatus={licenseStatus} setLicenseStatus={setLicenseStatus} />
        </Router>
      </AuthProvider>
    </BusinessProvider>
  );
}

export default App;
