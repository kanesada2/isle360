import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { ScoreBreakdown } from '@/domain/facility-actions';

type Props = {
  visible: boolean;
  breakdown: ScoreBreakdown;
  onRestart: () => void;
};

const RESOURCE_LABELS: Record<string, string> = {
  agriculture: '農産',
  mineral: '鉱物',
  energy: 'エネルギー',
};

export function ResultModal({ visible, breakdown, onRestart }: Props) {
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
              {breakdown.total.toLocaleString()} pt
            </Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.breakdown, { borderTopColor: colors.backgroundSelected }]}
            showsVerticalScrollIndicator={false}
          >
            {/* 資源量（合計＋内訳） */}
            <Row label="採掘した資源量" value={`${breakdown.resourcesMined.toLocaleString()} pt`} colors={colors} bold />
            {Object.entries(breakdown.resourcesByType).map(([type, amount]) => (
              <Row
                key={type}
                label={`　${RESOURCE_LABELS[type] ?? type}`}
                value={`${amount.toLocaleString()} pt`}
                colors={colors}
                sub
              />
            ))}

            {/* 研究投資（合計＋内訳） */}
            <Row label="研究投資" value={`${breakdown.researchSpent.toLocaleString()} pt`} colors={colors} bold />
            {breakdown.researchBreakdown.map((item, i) => (
              <Row
                key={i}
                label={`　${item.name}${item.repeatable ? ` Lv.${item.level}` : ''}`}
                value={`${item.cost.toLocaleString()} pt`}
                colors={colors}
                sub
              />
            ))}

            {/* 繁栄の象徴 */}
            {breakdown.monumentCount > 0 && (
              <Row
                label={`繁栄の象徴 ×${breakdown.monumentCount}`}
                value={`${breakdown.monumentBonus.toLocaleString()} pt`}
                colors={colors}
                bold
              />
            )}
          </ScrollView>

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

type RowProps = {
  label: string;
  value: string;
  colors: { text: string; textSecondary: string };
  bold?: boolean;
  sub?: boolean;
};

function Row({ label, value, colors, bold, sub }: RowProps) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, { color: sub ? colors.textSecondary : colors.text, fontWeight: bold ? '600' : '400' }]}>
        {label}
      </Text>
      <Text style={[styles.breakdownValue, { color: sub ? colors.textSecondary : colors.text }]}>
        {value}
      </Text>
    </View>
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
    maxHeight: '85%',
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
  scroll: {
    flexGrow: 0,
  },
  breakdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  breakdownLabel: {
    fontSize: 14,
    flex: 1,
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
