import { useEffect, useRef } from 'react';

type GameLoopCallback = (now: number, deltaMs: number) => void;

/**
 * requestAnimationFrame ベースのゲームループ。
 * active が true の間、毎フレーム callback(now, deltaMs) を呼び出す。
 * callback は ref 経由で保持するため、呼び出し元で useCallback 不要。
 */
export function useGameLoop(callback: GameLoopCallback, active: boolean): void {
  const callbackRef = useRef<GameLoopCallback>(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!active) return;

    let rafId: ReturnType<typeof requestAnimationFrame>;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const deltaMs = time - lastTime;
      lastTime = time;
      callbackRef.current(Date.now(), deltaMs);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [active]);
}
