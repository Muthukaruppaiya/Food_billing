import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Login from './components/Login';
import WaiterView from './components/WaiterView';
import ChefView from './components/ChefView';
import BillingView from './components/BillingView';
import AdminView from './components/AdminView';
import './App.css';

function AppContent() {
  const { role } = useApp();

  if (!role) return <Login />;
  if (role === 'WAITER') return <WaiterView />;
  if (role === 'CHEF') return <ChefView />;
  if (role === 'BILLING') return <BillingView />;
  if (role === 'ADMIN') return <AdminView />;
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
