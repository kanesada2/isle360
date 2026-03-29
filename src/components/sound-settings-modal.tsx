import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { CreditsModal } from '@/components/credits-modal';
import { Colors, Spacing } from '@/constants/theme';
import { useSoundContext } from '@/sound';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 渡すとモーダル下部に「ゲームをやめる」ボタンを表示する */
  onQuit?: () => void;
};

export function SoundSettingsModal({ visible, onClose, onQuit }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { seEnabled, bgmEnabled, setSeEnabled, setBgmEnabled } = useSoundContext();
  const [creditsVisible, setCreditsVisible] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.backgroundElement }]} onPress={() => {}}>

          <Text style={[styles.title, { color: colors.text }]}>Options</Text>

          <View style={[styles.divider, { backgroundColor: colors.backgroundSelected }]} />

          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>BGM</Text>
            <Switch
              value={bgmEnabled}
              onValueChange={setBgmEnabled}
            />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>SE</Text>
            <Switch
              value={seEnabled}
              onValueChange={setSeEnabled}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.backgroundSelected }]} />

          <Pressable
            style={({ pressed }) => [
              styles.creditButton,
              { backgroundColor: pressed ? colors.backgroundSelected : 'transparent' },
            ]}
            onPress={() => setCreditsVisible(true)}
          >
            <Text style={[styles.creditText, { color: colors.textSecondary }]}>Credits</Text>
          </Pressable>

          {onQuit && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.backgroundSelected }]} />
              <Pressable
                style={({ pressed }) => [
                  styles.quitButton,
                  { backgroundColor: pressed ? colors.backgroundSelected : 'transparent' },
                ]}
                onPress={onQuit}
              >
                <Text style={[styles.quitText, { color: '#EF5350' }]}>ゲームをやめる</Text>
              </Pressable>
            </>
          )}

        </Pressable>
      </Pressable>

      <CreditsModal visible={creditsVisible} onClose={() => setCreditsVisible(false)} />
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
    maxWidth: 320,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  label: {
    fontSize: 16,
  },
  creditButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  creditText: {
    fontSize: 14,
  },
  quitButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  quitText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
