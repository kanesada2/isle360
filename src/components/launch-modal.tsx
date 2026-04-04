import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type LaunchItem = {
  key: string;
  label: string;
  description: string;
  /** 選択時に表示する入力欄の種別 */
  inputType?: 'seed' | 'code';
  inputPlaceholder?: string;
  disabled?: boolean;
  /** GO ボタンの代替ラベル */
  goLabel?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items: LaunchItem[];
  /** GO ボタン押下時に呼ばれる。inputValue は入力欄がある項目のみ渡る */
  onGo: (key: string, inputValue: string) => void;
  /** true の間 GO ボタンをローディング状態にして押せなくする */
  goLoading?: boolean;
};

export function LaunchModal({ visible, onClose, items, onGo, goLoading = false }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [selectedKey, setSelectedKey] = useState(items[0]?.key ?? '');
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedKey(items[0]?.key ?? '');
      setInputValue('');
    }
  }, [visible, items]);

  useEffect(() => {
    setInputValue('');
  }, [selectedKey]);

  const selected = items.find((item) => item.key === selectedKey);
  const goDisabled = goLoading || (selected?.disabled ?? false) ||
    (selected?.inputType !== undefined && inputValue.trim() === '');

  function handleItemPress(key: string) {
    setSelectedKey(key);
    if (items.find((i) => i.key === key)?.inputType) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.backgroundElement }]} onPress={() => {}}>

          {/* 選択リスト */}
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => {
              const isSelected = item.key === selectedKey;
              return (
                <Pressable
                  key={item.key}
                  style={[
                    styles.listItem,
                    {
                      backgroundColor: isSelected ? colors.backgroundSelected : colors.background,
                      borderColor: isSelected ? colors.text : colors.backgroundSelected,
                      opacity: item.disabled ? 0.35 : 1,
                    },
                  ]}
                  onPress={() => handleItemPress(item.key)}
                >
                  <Text style={[styles.listItemLabel, { color: colors.text }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 説明 */}
          <View style={[styles.descriptionArea, { borderTopColor: colors.backgroundSelected }]}>
            <Text style={[styles.descriptionTitle, { color: colors.text }]}>
              {selected?.label ?? ''}
            </Text>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
              {selected?.description ?? ''}
            </Text>
          </View>

          {/* 入力欄（seed / code） */}
          {selected?.inputType && (
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.backgroundSelected,
                  backgroundColor: colors.background,
                  ...(selected.inputType === 'code' ? styles.inputMultiline : {}),
                },
              ]}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={selected.inputPlaceholder ?? ''}
              placeholderTextColor={colors.textSecondary}
              keyboardType={selected.inputType === 'seed' ? 'number-pad' : 'default'}
              multiline={selected.inputType === 'code'}
              textAlignVertical={selected.inputType === 'code' ? 'top' : 'center'}
              autoCorrect={false}
              autoCapitalize="none"
            />
          )}

          {/* GO ボタン */}
          <Pressable
            disabled={goDisabled}
            style={({ pressed }) => [
              styles.goButton,
              {
                backgroundColor: pressed ? colors.backgroundSelected : colors.text,
                opacity: goDisabled ? 0.35 : 1,
              },
            ]}
            onPress={() => onGo(selectedKey, inputValue)}
          >
            <Text style={[styles.goButtonText, { color: colors.background }]}>
              {goLoading ? '...' : (selected?.goLabel ?? 'GO')}
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  listItemLabel: {
    fontSize: 15,
    fontWeight: '600',
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
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: Spacing.one,
  },
  inputMultiline: {
    minHeight: 72,
  },
  goButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  goButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
