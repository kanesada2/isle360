import React from 'react';
import { Modal, Pressable, StyleSheet, Text, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { Mission } from '@/domain/tutorial';

type Props = {
  /** null のとき非表示 */
  mission: Mission | null;
  onDismiss: () => void;
};

/** 個々のミッション達成時に表示するモーダル */
export function MissionCompleteModal({ mission, onDismiss }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Modal
      visible={mission !== null}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.backgroundElement }]}
          onPress={() => {}}
        >
          <Text style={styles.badge}>✓ ミッション達成</Text>
          <Text style={[styles.label, { color: colors.text }]}>{mission?.label}</Text>
          {!!mission?.completionMessage && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {mission.completionMessage}
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
            ]}
            onPress={onDismiss}
          >
            <Text style={[styles.buttonText, { color: colors.background }]}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  badge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4CAF50',
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.two,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
