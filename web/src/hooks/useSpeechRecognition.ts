import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RecognitionStatus = "idle" | "listening" | "stopped" | "error";

export interface UseSpeechRecognitionOptions {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  maxSilenceMs?: number;
}

export interface UseSpeechRecognitionResult {
  isSupported: boolean;
  status: RecognitionStatus;
  transcript: string;
  partial: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(
  options?: UseSpeechRecognitionOptions
): UseSpeechRecognitionResult {
  const {
    lang = "zh-CN",
    interimResults = true,
    continuous = true,
    maxSilenceMs = 2000,
  } = options || {};

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [status, setStatus] = useState<RecognitionStatus>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [partial, setPartial] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const silenceTimer = useRef<number | null>(null);

  const isSupported = useMemo(() => {
    const w = window as unknown as {
      webkitSpeechRecognition?: any;
      SpeechRecognition?: any;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    const w = window as unknown as {
      webkitSpeechRecognition?: any;
      SpeechRecognition?: any;
    };
    const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as any;
    const recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = interimResults;
    recognition.continuous = continuous;

    recognition.onstart = () => {
      setStatus("listening");
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText)
        setTranscript((prev) =>
          prev ? prev + " " + finalText.trim() : finalText.trim()
        );
      setPartial(interimText);

      if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
      silenceTimer.current = window.setTimeout(() => {
        // Auto stop on silence
        recognition.stop();
      }, maxSilenceMs);
    };

    recognition.onerror = (e: any) => {
      setStatus("error");
      setError(e?.error || "speech_recognition_error");
    };

    recognition.onend = () => {
      setStatus("stopped");
      if (silenceTimer.current) {
        window.clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, [continuous, interimResults, isSupported, lang, maxSilenceMs]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript("");
    setPartial("");
    setError(null);
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Some browsers throw if called while already started
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setPartial("");
    setError(null);
    setStatus("idle");
  }, []);

  return {
    isSupported,
    status,
    transcript,
    partial,
    error,
    start,
    stop,
    reset,
  };
}
