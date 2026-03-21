import React from 'react';
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
  /** true の場合、選択・実行不可でグレーアウト表示 */
  disabled?: boolean;
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
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
              return (
                <Pressable
                  key={item.key}
                  disabled={disabled}
                  style={[
                    styles.listItem,
                    {
                      backgroundColor: isSelected
                        ? colors.backgroundSelected
                        : colors.background,
                      borderColor: isSelected ? colors.text : colors.backgroundSelected,
                      opacity: disabled ? 0.35 : 1,
                    },
                  ]}
                  onPress={() => onSelectKey(item.key)}
                >
                  <Text style={[styles.listItemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.listItemCost, { color: colors.textSecondary }]}>
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
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.text },
            ]}
            onPress={onAction}
          >
            <Text style={[styles.actionButtonText, { color: colors.background }]}>
              {actionLabel}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    maxHeight: '75%',
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
});
