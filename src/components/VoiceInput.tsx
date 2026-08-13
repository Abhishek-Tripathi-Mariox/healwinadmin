import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Input, cn } from "./ui";

/**
 * A text Input with an inline dictation button — click the mic, speak, the
 * transcript replaces the field's value. Uses the browser's built-in
 * SpeechRecognition (Web Speech API): free, no API key, no per-request cost,
 * runs through the browser rather than a service we integrate — the mic
 * button simply doesn't render in browsers that lack support (mainly
 * Chrome/Edge today) instead of erroring.
 */
interface VoiceInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onTranscript: (text: string) => void;
}

const getSpeechRecognition = (): any =>
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, className, ...props }) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const SR = getSpeechRecognition();

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) onTranscript(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    /* `className` goes on the WRAPPER, not the inner input: callers pass layout
       classes (col-span-*, w-40) expecting them to size this control's slot in
       a grid/flex row. Putting them on the input left the wrapper — the actual
       grid child — sizing to content, which collapsed the field. The input
       itself is already w-full from the Input base. */
    <div className={cn("relative", className)}>
      <Input className={cn(SR && "pr-7")} {...props} />
      {SR && (
        <button
          type="button"
          onClick={toggle}
          title={listening ? "Listening… click to stop" : "Dictate"}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5",
            listening ? "animate-pulse text-red-600" : "text-gray-400 hover:text-gray-600",
          )}
        >
          {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
};
