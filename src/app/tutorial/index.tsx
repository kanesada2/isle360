import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { TUTORIAL_CATALOG } from '@/domain/tutorial-catalog';

export default function TutorialIndexScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            { 
              backgroundColor: pressed ? colors.backgroundSelected : 'transparent',
              borderColor: colors.text,
            },
          ]}
          onPress={() => router.replace('/')}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>トップへ</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>チュートリアル</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {TUTORIAL_CATALOG.map((entry, index) => (
          <Pressable
            key={entry.id}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed
                  ? colors.backgroundSelected
                  : colors.backgroundElement,
              },
            ]}
            onPress={() => router.push(`/tutorial/${entry.id}`)}
          >
            <View style={[styles.stageNumber, { backgroundColor: colors.backgroundSelected }]}>
              <Text style={[styles.stageNumberText, { color: colors.text }]}>
                {index + 1}
              </Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {entry.title}
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                {entry.description}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backButton: {
    width: 90,
    borderWidth: 1,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
    alignItems: 'center'
  },
  backButtonText: {
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  stageNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageNumberText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
    gap: Spacing.one,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '300',
  },
});
