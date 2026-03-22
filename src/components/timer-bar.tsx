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
  const barColor = ratio < 0.2 ? '#F44336' : colors.text;

  return (
    <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: barColor }]} />
      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.label,
            {
              // バー色（colors.text）の反対色なのでバー上で視認できる
              color: colors.background,
              // ハロー効果でバーがない背景上でも読める
              textShadowColor: colors.text,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 6,
            },
          ]}
        >
          {formatTime(remaining)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: 44,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  labelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
