import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  remaining: number;
  sessionDurationMs: number;
};

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function TimerBar({ remaining, sessionDurationMs }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const ratio = remaining / sessionDurationMs;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: ratio < 0.2 ? '#F44336' : colors.text,
            },
          ]}
        />
      </View>
      <Text style={[styles.text, { color: colors.textSecondary }]}>{formatTime(remaining)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    width: 40,
    textAlign: 'right',
  },
});
