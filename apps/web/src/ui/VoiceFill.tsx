/**
 * Speaks a field instead of typing it. One listen, then the words land in the box.
 */

import { useSpeechDictation } from '../hooks/useSpeechDictation';

export function VoiceFill({
  lang,
  mode = 'text',
  onText,
}: {
  lang: 'en' | 'sw';
  mode?: 'text' | 'phone';
  onText: (value: string) => void;
}) {
  const voice = useSpeechDictation(lang);
  const sw = lang === 'sw';

  return (
    <button
      type="button"
      className="reg-mic"
      aria-pressed={voice.listening}
      onClick={() => {
        void voice.listen({ mode }).then((heard) => {
          if (heard) onText(heard);
        });
      }}
    >
      {voice.listening ? (sw ? 'Inasikiliza…' : 'Listening…') : sw ? 'Sema' : 'Speak'}
    </button>
  );
}
