import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "./ui";

/**
 * Reads `text` aloud via the browser's built-in SpeechSynthesis (Web Speech
 * API) — free, no API key, same "on-device" approach as VoiceInput/
 * VoiceTextarea's dictation. Click again to stop mid-read. Renders nothing
 * if the text is empty or the browser lacks support.
 */
interface SpeakButtonProps {
  text?: string;
  className?: string;
}

const getSynth = (): SpeechSynthesis | undefined =>
  typeof window !== "undefined" ? window.speechSynthesis : undefined;

export const SpeakButton: React.FC<SpeakButtonProps> = ({ text, className }) => {
  const [speaking, setSpeaking] = useState(false);
  const synth = getSynth();

  // Stop if the component unmounts (e.g. modal closed) mid-read.
  useEffect(() => () => { synth?.cancel(); }, [synth]);

  if (!synth || !text?.trim()) return null;

  const toggle = () => {
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.cancel(); // clear any stale queued utterance first
    synth.speak(utterance);
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={speaking ? "Stop reading" : "Listen"}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        speaking ? "text-red-600" : "text-gray-500 hover:text-gray-700",
        className,
      )}
    >
      {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      {speaking ? "Stop" : "Listen"}
    </button>
  );
};
