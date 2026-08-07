import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Textarea, cn } from "./ui";

/**
 * A Textarea with an inline dictation button — click the mic, speak (keeps
 * listening until you click again), each phrase is appended to the existing
 * text instead of replacing it (unlike VoiceInput's single-field replace —
 * a consultation note is built up over several sentences, not one word).
 * Same free, on-device Web Speech API as VoiceInput; no-ops in browsers that
 * lack it.
 */
interface VoiceTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onTranscript: (nextValue: string) => void;
}

const getSpeechRecognition = (): any =>
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

export const VoiceTextarea: React.FC<VoiceTextareaProps> = ({ onTranscript, value, className, ...props }) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const valueRef = useRef(String(value ?? ""));
  valueRef.current = String(value ?? "");
  const SR = getSpeechRecognition();

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      text = text.trim();
      if (!text) return;
      const next = valueRef.current ? `${valueRef.current} ${text}` : text;
      valueRef.current = next;
      onTranscript(next);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="relative">
      <Textarea value={value} className={cn(SR && "pr-8", className)} {...props} />
      {SR && (
        <button
          type="button"
          onClick={toggle}
          title={listening ? "Listening… click to stop" : "Dictate"}
          className={cn(
            "absolute right-1.5 top-1.5 rounded p-1",
            listening ? "animate-pulse text-red-600" : "text-gray-400 hover:text-gray-600",
          )}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
};
