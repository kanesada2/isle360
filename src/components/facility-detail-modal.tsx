import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type DetailRow = { label: string; value: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  rows: DetailRow[];
};

export function FacilityDetailModal({ visible, onClose, title, rows }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.backgroundElement }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          <View style={[styles.rows, { borderTopColor: colors.backgroundSelected }]}>
            {rows.map((row) => (
              <View key={row.label} style={[styles.row, { borderBottomColor: colors.backgroundSelected }]}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: colors.background }]}>閉じる</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  closeButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
