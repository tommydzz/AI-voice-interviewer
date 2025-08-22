import { useCallback, useMemo, useRef, useState } from "react";

type TtsStatus = "idle" | "speaking" | "stopped" | "error";

export interface UseTextToSpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface UseTextToSpeechResult {
  isSupported: boolean;
  status: TtsStatus;
  speak: (text: string) => void;
  cancel: () => void;
}

export function useTextToSpeech(
  options?: UseTextToSpeechOptions
): UseTextToSpeechResult {
  const { lang = "zh-CN", rate = 1, pitch = 1, volume = 1 } = options || {};
  const [status, setStatus] = useState<TtsStatus>("idle");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = useMemo(() => "speechSynthesis" in window, []);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setStatus("stopped");
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;
      cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = volume;
      utter.onstart = () => setStatus("speaking");
      utter.onerror = () => setStatus("error");
      utter.onend = () => setStatus("stopped");
      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
    },
    [cancel, isSupported, lang, pitch, rate, volume]
  );

  return { isSupported, status, speak, cancel };
}
