import { Stack } from 'expo-router';
import React from 'react';
import { AuthProvider } from '../src/auth/AuthContext';
import { SelectionProvider } from '../src/context/SelectionContext';
import { StationFaultProvider } from '../src/context/StationFaultContext';
import { theme } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SelectionProvider>
        <StationFaultProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.background },
              headerTintColor: theme.textPrimary,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="map" options={{ title: 'Harita', headerShown: false }} />
            <Stack.Screen name="statistics" options={{ title: 'İstatistikler' }} />
            <Stack.Screen name="about" options={{ title: 'Proje Hakkında' }} />
            <Stack.Screen
              name="municipality-dashboard"
              options={{ title: 'Belediye Karar Destek Paneli' }}
            />
            <Stack.Screen name="station/[durakId]" options={{ title: 'Durak Detayı', headerShown: false }} />
          </Stack>
        </StationFaultProvider>
      </SelectionProvider>
    </AuthProvider>
  );
}
