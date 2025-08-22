// 最小声明，避免 TypeScript 对 Web Speech API 的类型缺失报错

type SpeechRecognition = any;
type SpeechRecognitionEvent = any;

interface Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}
