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
  const label = formatTime(remaining);

  return (
    <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
      {/* バーが届かない領域：背景色上で読める色のテキスト */}
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </View>

      {/* フィル：バー色上で読める色のテキストをクリップ描画 */}
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: barColor }]}>
        <View style={styles.labelWrap}>
          <Text style={[styles.label, { color: colors.background }]}>{label}</Text>
        </View>
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
    overflow: 'hidden',
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
