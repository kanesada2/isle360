import React from 'react';
import { Modal, Pressable, StyleSheet, Text, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
export type HintContent = {
  title?: string;
  body: string;
  buttonLabel?: string;
};

type Props = {
  hint: HintContent | null;
  onDismiss: () => void;
};

export function TutorialHintModal({ hint: trigger, onDismiss }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Modal
      visible={trigger !== null}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.backgroundElement }]}
          onPress={() => {}}
        >
          {!!trigger?.title && (
            <Text style={[styles.title, { color: colors.text }]}>{trigger.title}</Text>
          )}
          <Text style={[styles.body, { color: colors.textSecondary }]}>{trigger?.body}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
            ]}
            onPress={onDismiss}
          >
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {trigger?.buttonLabel ?? 'OK'}
            </Text>
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
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
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
