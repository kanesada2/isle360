import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { TutorialStage } from '@/domain/tutorial';

type Props = {
  visible: boolean;
  stage: TutorialStage;
  onClose: () => void;
};

/** 全ミッション達成時に表示するモーダル */
export function TutorialCompleteModal({ visible, stage, onClose }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const modal = stage.completionModal;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {modal?.title ?? '全ミッション達成！'}
          </Text>
          {!!modal?.body && (
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {modal.body}
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {modal?.buttonLabel ?? '次へ'}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    fontSize: 22,
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
