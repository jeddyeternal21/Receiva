import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, Sparkles } from 'lucide-react';

interface VoiceInputTriggerProps {
  onDictationComplete: (finalTranscript: string) => void;
}

export const VoiceInputTrigger: React.FC<VoiceInputTriggerProps> = ({
  onDictationComplete
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimText, setInterimText] = useState<string>('');
  const [finalText, setFinalText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition on mount
  useEffect(() => {
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    rec.onerror = (event: any) => {
      console.error('[VoiceInput] Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please check your browser permission settings.');
      } else {
        setError(`Error: ${event.error}`);
      }
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onresult = (event: any) => {
      let accumulatedFinal = '';
      let accumulatedInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          accumulatedFinal += transcript + ' ';
        } else {
          accumulatedInterim += transcript;
        }
      }

      if (accumulatedFinal) {
        setFinalText((prev) => prev + accumulatedFinal);
      }
      setInterimText(accumulatedInterim);
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Trigger Speech Recognition Start / Stop
  const toggleListening = () => {
    if (!isSupported || !recognitionRef.current) return;

    if (isListening) {
      handleStop();
    } else {
      setFinalText('');
      setInterimText('');
      setError(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('[VoiceInput] Failed to start recognition:', err);
      }
    }
  };

  const handleStop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      
      // Combine whatever we have captured
      const completedSentence = (finalText + interimText).trim();
      if (completedSentence) {
        onDictationComplete(completedSentence);
      }
    }
    setIsListening(false);
  };

  if (!isSupported) {
    return (
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <span>Voice input unsupported in this browser. Try Chrome or Safari.</span>
      </div>
    );
  }

  return (
    <div className="font-sans">
      {/* Soundwave animation Stylesheet */}
      <style>{`
        @keyframes soundwave {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(1.3); }
        }
        .soundwave-bar {
          animation: soundwave 0.8s ease-in-out infinite;
          transform-origin: bottom;
        }
      `}</style>

      <div className="flex items-center gap-3">
        {/* Pulsing Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          className={`flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all border ${
            isListening
              ? 'bg-[#22c55e] text-white border-[#16a34a] shadow-md shadow-green-100 animate-pulse'
              : 'bg-gray-50 text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-gray-200'
          }`}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* Listening Soundwave indicators */}
        {isListening ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-3 py-1.5 animate-fadeIn">
            {/* Active Soundwave Animation bars */}
            <div className="flex items-end gap-0.5 h-4 pt-1">
              <div className="w-0.5 bg-green-600 rounded-full soundwave-bar" style={{ animationDelay: '0.1s', height: '12px' }} />
              <div className="w-0.5 bg-green-600 rounded-full soundwave-bar" style={{ animationDelay: '0.3s', height: '16px' }} />
              <div className="w-0.5 bg-green-600 rounded-full soundwave-bar" style={{ animationDelay: '0.2s', height: '10px' }} />
              <div className="w-0.5 bg-green-600 rounded-full soundwave-bar" style={{ animationDelay: '0.4s', height: '14px' }} />
              <div className="w-0.5 bg-green-600 rounded-full soundwave-bar" style={{ animationDelay: '0.15s', height: '12px' }} />
            </div>
            <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-green-500 animate-spin" />
              Receiva Listening...
            </span>

            {/* Explicit Done/Stop button */}
            <button
              type="button"
              onClick={handleStop}
              className="ml-2 bg-[#22c55e] hover:bg-[#16a34a] text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">
            Click microphone to dictate items (e.g. "Add 3 Jasmine Rice")
          </span>
        )}
      </div>

      {/* Error Alert Display */}
      {error && (
        <div className="mt-2 p-2 bg-rose-50 border border-rose-100 rounded-lg text-[10px] text-rose-600 flex items-center gap-1.5 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Real-time Streaming Container (Interim transcript results) */}
      {(isListening || finalText || interimText) && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg max-h-24 overflow-y-auto animate-slideDown shadow-inner">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Voice Transcript Preview
          </div>
          <p className="text-xs leading-relaxed">
            {finalText && <span className="text-gray-800 font-medium">{finalText}</span>}
            {interimText && <span className="text-gray-400 italic">{interimText}</span>}
            {!finalText && !interimText && (
              <span className="text-gray-300 italic">Say something...</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};
