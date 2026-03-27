import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TutorialScreen } from '@/components/tutorial-screen';
import { Colors, Spacing } from '@/constants/theme';
import { TUTORIAL_CATALOG } from '@/domain/tutorial-catalog';

export default function TutorialStagePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const entry = TUTORIAL_CATALOG.find(e => e.id === id);

  if (!entry) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            ステージが見つかりません
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <TutorialScreen
      stage={entry.stage}
      onComplete={() => router.replace('/tutorial' as never)}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  notFoundText: {
    fontSize: 15,
  },
});
