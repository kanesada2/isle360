import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { authClient } from '@/lib/auth-client';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AccountModal({ visible, onClose }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { data: session, isPending } = authClient.useSession();
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const callbackURL = Platform.OS === 'web'
        ? window.location.origin
        : Linking.createURL('/');
      await authClient.signIn.social({ provider: 'google', callbackURL });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    try {
      await authClient.signOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.backgroundElement }]} onPress={() => {}}>

          <Text style={[styles.title, { color: colors.text }]}>Account</Text>

          <View style={[styles.divider, { backgroundColor: colors.backgroundSelected }]} />

          {isPending ? (
            <ActivityIndicator />
          ) : session ? (
            <>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.text }]}>{session.user.name}</Text>
                <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{session.user.email}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.backgroundSelected }]} />

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: pressed ? colors.backgroundSelected : 'transparent' },
                ]}
                onPress={handleSignOut}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={[styles.actionText, { color: '#EF5350' }]}>サインアウト</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                スコアの登録、デイリーチャレンジへの挑戦にはログインが必要です。
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.googleButton,
                  { opacity: loading || pressed ? 0.7 : 1 },
                ]}
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.googleButtonText}>Googleでサインイン</Text>
                )}
              </Pressable>
            </>
          )}

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
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  userInfo: {
    gap: Spacing.one,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
  },
  actionButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
