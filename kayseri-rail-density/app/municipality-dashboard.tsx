import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '../src/auth/AuthContext';
import { MunicipalityDashboardScreen } from '../src/screens/MunicipalityDashboardScreen';

export default function MunicipalityDashboardRoute() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/');
    }
  }, [isAdmin]);

  if (!isAdmin) return null;
  return <MunicipalityDashboardScreen />;
}
