import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type DetailRow = { label: string; value: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  rows: DetailRow[];
  onDemolish?: () => void;
  demolishDisabled?: boolean;
};

export function FacilityDetailModal({ visible, onClose, title, rows, onDemolish, demolishDisabled = false }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [confirming, setConfirming] = useState(false);
  const blockBackdropRef = useRef(false);
  useEffect(() => {
    if (visible) {
      blockBackdropRef.current = true;
      const id = setTimeout(() => { blockBackdropRef.current = false; }, 150);
      return () => clearTimeout(id);
    } else {
      setConfirming(false);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={() => { if (!blockBackdropRef.current) onClose(); }}>
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

          {onDemolish && (
            confirming ? (
              <View style={[styles.confirmBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.confirmText, { color: colors.textSecondary }]}>
                  本当に破壊しますか？（10秒）
                </Text>
                <View style={styles.confirmButtons}>
                  <Pressable
                    style={({ pressed }) => [styles.confirmBtn, { backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement }]}
                    onPress={() => setConfirming(false)}
                  >
                    <Text style={[styles.confirmBtnText, { color: colors.text }]}>キャンセル</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.confirmBtn, { backgroundColor: pressed ? '#c62828' : '#F44336' }]}
                    onPress={() => { setConfirming(false); onDemolish(); }}
                  >
                    <Text style={[styles.confirmBtnText, { color: '#ffffff' }]}>破壊する</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                disabled={demolishDisabled}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: pressed ? '#c62828' : '#F44336',
                    opacity: demolishDisabled ? 0.35 : 1,
                    marginTop: Spacing.two,
                  },
                ]}
                onPress={() => setConfirming(true)}
              >
                <Text style={[styles.closeButtonText, { color: '#ffffff' }]}>破壊する</Text>
              </Pressable>
            )
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: Spacing.three,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    width: '88%',
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
  confirmBox: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  confirmText: {
    fontSize: 13,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
