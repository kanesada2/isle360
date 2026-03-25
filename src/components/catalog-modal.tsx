import React, { useEffect, useState } from 'react';
import {
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type CatalogModalItem = {
  key: string;
  name: string;
  /** コスト表示文字列（例: "200 G"、"200 G〜"） */
  costLabel: string;
  /** true の場合、グレーアウト表示・実行不可（選択は可能） */
  disabled?: boolean;
  /** true の場合、特別な研究として金色ボーダーで強調表示する */
  special?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items: CatalogModalItem[];
  selectedKey: string;
  onSelectKey: (key: string) => void;
  descriptionTitle: string;
  descriptionText: string;
  actionLabel: string;
  onAction: () => void;
  onDemolish?: () => void;
  demolishDisabled?: boolean;
  actionForceDisabled?: boolean;
};

export function CatalogModal({
  visible,
  onClose,
  items,
  selectedKey,
  onSelectKey,
  descriptionTitle,
  descriptionText,
  actionLabel,
  onAction,
  onDemolish,
  demolishDisabled = false,
  actionForceDisabled = false,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [confirming, setConfirming] = useState(false);
  useEffect(() => { if (!visible) setConfirming(false); }, [visible]);

  const selectedItem = items.find((item) => item.key === selectedKey);
  const actionDisabled = (selectedItem?.disabled ?? false) || actionForceDisabled;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 背景タップで閉じる */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* カード内タップは伝播させない */}
        <Pressable style={[styles.card, { backgroundColor: colors.backgroundElement }]} onPress={() => {}}>

          {/* 一覧 */}
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => {
              const isSelected = item.key === selectedKey;
              const disabled = item.disabled ?? false;
              const special = item.special ?? false;
              return (
                <Pressable
                  key={item.key}
                  style={[
                    styles.listItem,
                    special && styles.listItemSpecial,
                    {
                      backgroundColor: isSelected
                        ? (special ? '#3a2d00' : colors.backgroundSelected)
                        : (special ? '#1a1400' : colors.background),
                      borderColor: isSelected
                        ? (special ? '#FFD700' : colors.text)
                        : (special ? '#8B6914' : colors.backgroundSelected),
                      opacity: disabled ? 0.35 : 1,
                    },
                  ]}
                  onPress={() => onSelectKey(item.key)}
                >
                  <View style={styles.listItemLeft}>
                    {special && (
                      <Text style={styles.specialBadge}>✦</Text>
                    )}
                    <Text style={[styles.listItemName, { color: special ? '#FFD700' : colors.text }]}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={[styles.listItemCost, { color: special ? '#C9A227' : colors.textSecondary }]}>
                    {item.costLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 説明 */}
          <View style={[styles.descriptionArea, { borderTopColor: colors.backgroundSelected }]}>
            <Text style={[styles.descriptionTitle, { color: colors.text }]}>{descriptionTitle}</Text>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
              {descriptionText}
            </Text>
          </View>

          {/* アクションボタン */}
          <Pressable
            disabled={actionDisabled}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: pressed ? colors.backgroundSelected : colors.text,
                opacity: actionDisabled ? 0.35 : 1,
              },
            ]}
            onPress={onAction}
          >
            <Text style={[styles.actionButtonText, { color: colors.background }]}>
              {actionLabel}
            </Text>
          </Pressable>

          {/* 破壊ボタン */}
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
                  styles.actionButton,
                  {
                    backgroundColor: pressed ? '#c62828' : '#F44336',
                    opacity: demolishDisabled ? 0.35 : 1,
                  },
                ]}
                onPress={() => setConfirming(true)}
              >
                <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>破壊する</Text>
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
    maxHeight: '72%',
  },
  listScroll: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  listItemSpecial: {
    borderWidth: 2,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specialBadge: {
    fontSize: 14,
    color: '#FFD700',
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  listItemCost: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  descriptionArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 20,
  },
  actionButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  actionButtonText: {
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
