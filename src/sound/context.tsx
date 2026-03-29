import { Audio } from 'expo-av';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { BgmKey, SeKey, SoundConfig } from './types';

interface SoundContextValue {
  playEffect: (key: SeKey) => void;
  playBgm: (key: BgmKey) => void;
  stopBgm: () => void;
  seEnabled: boolean;
  bgmEnabled: boolean;
  setSeEnabled: (enabled: boolean) => void;
  setBgmEnabled: (enabled: boolean) => void;
}

const SoundContext = createContext<SoundContextValue>({
  playEffect: () => {},
  playBgm: () => {},
  stopBgm: () => {},
  seEnabled: true,
  bgmEnabled: true,
  setSeEnabled: () => {},
  setBgmEnabled: () => {},
});

interface Props {
  config: SoundConfig | null;
  children: React.ReactNode;
}

export function SoundProvider({ config, children }: Props) {
  const [seEnabled, setSeEnabled] = useState(config?.initialSeEnabled ?? true);
  const [bgmEnabled, setBgmEnabled] = useState(config?.initialBgmEnabled ?? true);
  const bgmRef = useRef<Audio.Sound | null>(null);
  const bgmKeyRef = useRef<BgmKey | null>(null);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    }).catch(() => {});
  }, []);

  // BGM オン/オフ切り替え
  useEffect(() => {
    if (!bgmRef.current) return;
    if (bgmEnabled) {
      bgmRef.current.playAsync().catch(() => {});
    } else {
      bgmRef.current.pauseAsync().catch(() => {});
    }
  }, [bgmEnabled]);

  const playEffect = useCallback(
    (key: SeKey) => {
      if (!seEnabled || !config?.se?.[key]) return;
      const source = config.se[key]!;
      Audio.Sound.createAsync(source)
        .then(({ sound }) => {
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
            }
          });
          return sound.playAsync();
        })
        .catch(() => {});
    },
    [seEnabled, config],
  );

  const playBgm = useCallback(
    (key: BgmKey) => {
      if (!config?.bgm?.[key]) return;
      if (bgmKeyRef.current === key && bgmRef.current) return;

      bgmRef.current?.unloadAsync().catch(() => {});
      bgmRef.current = null;
      bgmKeyRef.current = key;

      if (!bgmEnabled) return;

      const source = config.bgm[key]!;
      const volume = config.bgmVolume ?? 0.5;
      Audio.Sound.createAsync(source, { isLooping: true, shouldPlay: true, volume })
        .then(({ sound }) => {
          bgmRef.current = sound;
        })
        .catch(() => {});
    },
    [bgmEnabled, config],
  );

  const stopBgm = useCallback(() => {
    bgmRef.current?.unloadAsync().catch(() => {});
    bgmRef.current = null;
    bgmKeyRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      bgmRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  return (
    <SoundContext.Provider value={{ playEffect, playBgm, stopBgm, seEnabled, bgmEnabled, setSeEnabled, setBgmEnabled }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundContext(): SoundContextValue {
  return useContext(SoundContext);
}
