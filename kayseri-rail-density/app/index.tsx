import React from 'react';
import { useAuth } from '../src/auth/AuthContext';
import { HomeScreen } from '../src/screens/HomeScreen';
import { MapScreen } from '../src/screens/MapScreen';

export default function Index() {
  const { isAdmin } = useAuth();
  return isAdmin ? <HomeScreen /> : <MapScreen />;
}
