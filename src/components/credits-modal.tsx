import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type CreditItem = string | { text: string; url: string };

type Section = {
  heading: string;
  items: CreditItem[];
};

const CREDITS: Section[] = [
  {
    heading: 'Produce & Programming',
    items: ['Nosada'],
  },
  {
    heading: 'Illustration & UI Design',
    items: ['準備中'],//['Yuki'],
  },
  {
    heading: 'BGM',
    items: [
      { text: '騒音のない世界', url: 'https://noiselessworld.net/' },
    ],
  },
  {
    heading: 'SE',
    items: [
      { text: '効果音ラボ', url: 'https://soundeffect-lab.info/' },
      { text: 'On-Jin～音人～', url: 'https://on-jin.com/' },
      { text: 'フリー効果音素材 くらげ工匠', url: 'http://www.kurage-kosho.info/' },
    ],
  },
];

function CreditItemView({ item, textColor, linkColor }: { item: CreditItem; textColor: string; linkColor: string }) {
  if (typeof item === 'string') {
    return <Text style={[styles.item, { color: textColor }]}>{item}</Text>;
  }
  return (
    <Pressable onPress={() => Linking.openURL(item.url)}>
      <Text style={[styles.item, styles.link, { color: linkColor }]}>{item.text}</Text>
    </Pressable>
  );
}

export function CreditsModal({ visible, onClose }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.backgroundElement }]} onPress={() => {}}>

          <Text style={[styles.title, { color: colors.text }]}>クレジット</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {CREDITS.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={[styles.heading, { color: colors.textSecondary }]}>{section.heading}</Text>
                {section.items.map((item, i) => (
                  <CreditItemView key={i} item={item} textColor={colors.text} linkColor="#2196F3" />
                ))}
              </View>
            ))}
            {CREDITS.length === 0 && (
              <Text style={[styles.item, { color: colors.textSecondary }]}>（準備中）</Text>
            )}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: pressed ? colors.backgroundSelected : colors.background },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.closeText, { color: colors.text }]}>閉じる</Text>
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
    maxWidth: 320,
    maxHeight: '75%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  section: {
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  heading: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  item: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    textDecorationLine: 'underline',
  },
  closeButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
