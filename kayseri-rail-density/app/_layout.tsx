import { Stack } from 'expo-router';
import React from 'react';
import { SelectionProvider } from '../src/context/SelectionContext';
import { theme } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <SelectionProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Ana Sayfa' }} />
        <Stack.Screen name="map" options={{ title: 'Harita', headerShown: false }} />
        <Stack.Screen name="statistics" options={{ title: 'İstatistikler' }} />
        <Stack.Screen name="about" options={{ title: 'Proje Hakkında' }} />
        <Stack.Screen
          name="municipality-dashboard"
          options={{ title: 'Belediye Karar Destek Paneli' }}
        />
        <Stack.Screen name="station/[durakId]" options={{ title: 'Durak Detayı', headerShown: false }} />
      </Stack>
    </SelectionProvider>
  );
}
