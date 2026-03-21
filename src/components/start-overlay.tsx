import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  onStart: () => void;
};

export function StartOverlay({ onStart }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.title, { color: colors.text }]}>Island 360</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          360秒間で9マスのマップを開拓し尽くせ！{'\n'}
          資源の埋蔵量を確認しながら採集施設を建造し、どんどん資金を稼ごう。{'\n'}
          スコアを稼ぐためには研究所での研究がカギ。{'\n'}
          スワイプしてマップを確認し、準備ができたらスタートしてください。
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
          ]}
          onPress={onStart}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>スタート</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    opacity: 0.7,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
