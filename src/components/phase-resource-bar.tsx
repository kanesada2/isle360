import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { ResourcePhase } from '@/domain/types';

const PHASE_LABELS: Record<ResourcePhase, string> = {
  1: '農産',
  2: '鉱物',
  3: 'エネルギー',
};

const PHASE_COLORS: Record<ResourcePhase, string> = {
  1: '#4CAF50',
  2: '#FF9800',
  3: '#2196F3',
};

type Props = {
  phase: ResourcePhase;
  unlocked: boolean;
  total: number;
  current: number;
};

export function PhaseResourceBar({ phase, unlocked, total, current }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const ratio = total > 0 ? current / total : 0;
  const color = unlocked ? PHASE_COLORS[phase] : colors.backgroundSelected;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color }]}>{PHASE_LABELS[phase]}</Text>
      <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
        {unlocked && (
          <View
            style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: PHASE_COLORS[phase] }]}
          />
        )}
      </View>
      <Text style={[styles.value, { color: unlocked ? colors.textSecondary : colors.backgroundSelected }]}>
        {unlocked ? `${current.toFixed(1)} / ${total.toFixed(1)}` : '???'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.half,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  value: {
    fontSize: 10,
  },
});
