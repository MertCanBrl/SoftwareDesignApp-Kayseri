import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '../src/auth/AuthContext';
import { StatisticsScreen } from '../src/screens/StatisticsScreen';

export default function StatisticsRoute() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/');
    }
  }, [isAdmin]);

  if (!isAdmin) return null;
  return <StatisticsScreen />;
}
