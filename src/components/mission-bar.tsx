import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { MissionStatus } from '@/domain/tutorial';

type Props = {
  statuses: MissionStatus[];
};

/**
 * チュートリアルモード用の進捗バー。TimerBar の代わりに表示する。
 * 達成済みミッション数 / 全ミッション数をバーと数字で示す。
 */
export function MissionBar({ statuses }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const total = statuses.length;
  const completed = statuses.filter(s => s.completed).length;
  const ratio = total > 0 ? completed / total : 0;

  return (
    <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: '#4CAF50' }]} />
      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.label,
            {
              color: colors.background,
              textShadowColor: colors.text,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 6,
            },
          ]}
        >
          {completed} / {total} ミッション
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
  },
});
