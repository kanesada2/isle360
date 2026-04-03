import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { initDb } from '@/db/local';
import { SOUND_CONFIG, SoundProvider } from '@/sound';

export default function Layout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    initDb().catch(console.error);
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SoundProvider config={SOUND_CONFIG}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </SoundProvider>
    </GestureHandlerRootView>
  );
}
