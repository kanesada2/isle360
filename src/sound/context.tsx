import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
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
  const bgmRef = useRef<AudioPlayer | null>(null);
  const bgmKeyRef = useRef<BgmKey | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    }).catch(() => {});
  }, []);

  // BGM オン/オフ切り替え
  useEffect(() => {
    if (!bgmRef.current) return;
    if (bgmEnabled) {
      bgmRef.current.play();
    } else {
      bgmRef.current.pause();
    }
  }, [bgmEnabled]);

  const playEffect = useCallback(
    (key: SeKey) => {
      if (!seEnabled || !config?.se?.[key]) return;
      const source = config.se[key]!;
      const player = createAudioPlayer(source);
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          player.remove();
        }
      });
      player.play();
    },
    [seEnabled, config],
  );

  const playBgm = useCallback(
    (key: BgmKey) => {
      if (!config?.bgm?.[key]) return;
      if (bgmKeyRef.current === key && bgmRef.current) return;

      bgmRef.current?.remove();
      bgmRef.current = null;
      bgmKeyRef.current = key;

      if (!bgmEnabled) return;

      const source = config.bgm[key]!;
      const volume = config.bgmVolume ?? 0.5;
      const player = createAudioPlayer(source);
      player.loop = true;
      player.volume = volume;
      player.play();
      bgmRef.current = player;
    },
    [bgmEnabled, config],
  );

  const stopBgm = useCallback(() => {
    bgmRef.current?.remove();
    bgmRef.current = null;
    bgmKeyRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      bgmRef.current?.remove();
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
