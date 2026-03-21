import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  score: number;
  currentFunds: number;
  totalFundsSpent: number;
  onRestart: () => void;
};

export function ResultModal({ visible, score, currentFunds, totalFundsSpent, onRestart }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.title, { color: colors.text }]}>ゲーム終了</Text>

          <View style={[styles.scoreBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>スコア</Text>
            <Text style={[styles.scoreValue, { color: colors.text }]}>
              {score.toLocaleString()} G
            </Text>
          </View>

          <View style={[styles.breakdown, { borderTopColor: colors.backgroundSelected }]}>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>現在の資金</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>
                {Math.floor(currentFunds).toLocaleString()} G
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>使用した資金</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>
                {totalFundsSpent.toLocaleString()} G
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.restartButton,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
            ]}
            onPress={onRestart}
          >
            <Text style={[styles.restartButtonText, { color: colors.background }]}>
              もう一度プレイ
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreBox: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 13,
    marginBottom: Spacing.one,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  breakdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  restartButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  restartButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
