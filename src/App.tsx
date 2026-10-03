import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Volume2,
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';
import { VOCABULARY, CATEGORIES, VocabularyItem } from './vocabulary';
import {
  isSpeechRecognitionSupported,
  scorePronunciation,
  speakSpanishWord,
  ScoredResult,
} from './speech';

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Audio / Speech State
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSecondsLeft, setRecordingSecondsLeft] = useState<number>(5);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecordedAudio, setIsPlayingRecordedAudio] = useState<boolean>(false);

  // Scoring & Error state
  const [latestResult, setLatestResult] = useState<ScoredResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [showWordList, setShowWordList] = useState<boolean>(false);

  // Refs for audio streams & recording management
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const cancelSpeechRef = useRef<(() => void) | null>(null);

  const recognitionSupported = useMemo(() => isSpeechRecognitionSupported(), []);

  // Filtered vocabulary
  const filteredWords = useMemo(() => {
    if (selectedCategory === 'All Categories') {
      return VOCABULARY;
    }
    return VOCABULARY.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  // Ensure currentIndex stays within bounds when filtering
  useEffect(() => {
    if (currentIndex >= filteredWords.length) {
      setCurrentIndex(0);
    }
  }, [filteredWords.length, currentIndex]);

  const currentWord: VocabularyItem | undefined = filteredWords[currentIndex] || filteredWords[0];

  // Clean up recorded audio object URL
  const cleanupRecordedAudio = useCallback(() => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    setIsPlayingRecordedAudio(false);
  }, [recordedAudioUrl]);

  // Reset attempt state when word changes
  const resetAttemptForWord = useCallback(() => {
    setLatestResult(null);
    setErrorMessage(null);
    cleanupRecordedAudio();
  }, [cleanupRecordedAudio]);

  // Handle changing word
  const goToWord = useCallback(
    (newIndex: number) => {
      if (isRecording) {
        stopRecording();
      }
      if (cancelSpeechRef.current) {
        cancelSpeechRef.current();
      }
      resetAttemptForWord();
      setCurrentIndex(newIndex);
    },
    [isRecording, resetAttemptForWord]
  );

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      goToWord(currentIndex - 1);
    }
  }, [currentIndex, goToWord]);

  const handleNext = useCallback(() => {
    if (currentIndex < filteredWords.length - 1) {
      goToWord(currentIndex + 1);
    }
  }, [currentIndex, filteredWords.length, goToWord]);

  // Listen to Spanish pronunciation using SpeechSynthesis
  const handleListen = useCallback(() => {
    if (!currentWord) return;
    if (isRecording) {
      stopRecording();
    }
    setIsListeningVoice(true);
    cancelSpeechRef.current = speakSpanishWord(
      currentWord.spanish,
      () => setIsListeningVoice(true),
      () => setIsListeningVoice(false),
      () => setIsListeningVoice(false)
    );
  }, [currentWord, isRecording]);

  // Stop recording cleanly
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Recognition might already be stopped
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // MediaRecorder might already be inactive
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    setRecordingSecondsLeft(5);
  }, []);

  // Start recording user's voice
  const startRecording = useCallback(async () => {
    if (!currentWord) return;
    if (!recognitionSupported) {
      setErrorMessage('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // Cancel speech synthesis if speaking
    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      setIsListeningVoice(false);
    }

    // Reset attempt states
    setErrorMessage(null);
    setLatestResult(null);
    cleanupRecordedAudio();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch (err: any) {
      setErrorMessage('Please allow microphone access to record.');
      return;
    }

    // Set up MediaRecorder for replay
    const chunks: BlobPart[] = [];
    try {
      const mimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4'];
      const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const mediaRecorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedAudioUrl(url);
        }
      };

      mediaRecorder.start();
    } catch (recorderError) {
      console.warn('MediaRecorder error:', recorderError);
    }

    // Set up SpeechRecognition
    const SpeechRecConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecConstructor) {
      stopRecording();
      setErrorMessage('Speech recognition works best in Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecConstructor();
    recognitionRef.current = recognition;
    recognition.lang = 'es-MX';
    recognition.maxAlternatives = 3;
    recognition.interimResults = false;
    recognition.continuous = false;

    let receivedResult = false;

    recognition.onresult = (event: any) => {
      receivedResult = true;
      if (event.results && event.results[0]) {
        const resultItem = event.results[0];
        const alternatives: string[] = [];
        for (let i = 0; i < resultItem.length; i++) {
          if (resultItem[i]?.transcript) {
            alternatives.push(resultItem[i].transcript);
          }
        }

        if (alternatives.length > 0) {
          const scored = scorePronunciation(currentWord.spanish, alternatives);
          setLatestResult(scored);

          // Update session best score
          setBestScores((prev) => {
            const currentBest = prev[currentWord.id] ?? 0;
            return {
              ...prev,
              [currentWord.id]: Math.max(currentBest, scored.bestScore),
            };
          });
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setErrorMessage('Please allow microphone access to record.');
      } else if (event.error === 'no-speech') {
        setErrorMessage("We didn't catch that. Please try again.");
      }
    };

    recognition.onend = () => {
      if (!receivedResult) {
        setErrorMessage((prev) => prev || "We didn't catch that. Please try again.");
      }
      stopRecording();
    };

    try {
      recognition.start();
      setIsRecording(true);
      setRecordingSecondsLeft(5);

      // Countdown interval
      countdownIntervalRef.current = setInterval(() => {
        setRecordingSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto stop after 5 seconds
      timerRef.current = setTimeout(() => {
        stopRecording();
      }, 5000);
    } catch (startError) {
      stopRecording();
      setErrorMessage("Could not start recording. Please try again.");
    }
  }, [currentWord, recognitionSupported, cleanupRecordedAudio, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  // Audio replay handling
  const handlePlayRecording = useCallback(() => {
    if (!recordedAudioUrl) return;

    if (isPlayingRecordedAudio && audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlayingRecordedAudio(false);
      return;
    }

    const audio = new Audio(recordedAudioUrl);
    audioElementRef.current = audio;

    audio.onended = () => {
      setIsPlayingRecordedAudio(false);
    };

    audio.onerror = () => {
      setIsPlayingRecordedAudio(false);
    };

    audio.play().then(() => {
      setIsPlayingRecordedAudio(true);
    }).catch(() => {
      setIsPlayingRecordedAudio(false);
    });
  }, [recordedAudioUrl, isPlayingRecordedAudio]);

  // Keyboard shortcuts: Space (Record/Stop), L (Listen), ArrowLeft (Prev), ArrowRight (Next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is focusing an input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        toggleRecording();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleListen();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleRecording, handleListen, handlePrevious, handleNext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      cleanupRecordedAudio();
      if (cancelSpeechRef.current) {
        cancelSpeechRef.current();
      }
    };
  }, [stopRecording, cleanupRecordedAudio]);

  // Best score for the current word
  const currentBestScore = currentWord ? bestScores[currentWord.id] : undefined;
  const isMastered = currentBestScore !== undefined && currentBestScore >= 80;

  // Total mastered in session
  const totalMastered = useMemo(() => {
    return Object.values(bestScores).filter((s) => s >= 80).length;
  }, [bestScores]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="w-full max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            ES
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
              Spanish Pronunciation Practice
            </h1>
            <p className="text-xs text-slate-500">Listen, repeat, and get instant pronunciation scoring</p>
          </div>
        </div>

        {/* Mastered Counter & Word list toggle */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {totalMastered}/{VOCABULARY.length} Mastered
            </span>
          </div>
          <button
            onClick={() => setShowWordList(!showWordList)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
            title="Toggle word list"
            aria-label="Toggle word list"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Browser Support Warning Banner */}
      {!recognitionSupported && (
        <div className="w-full max-w-xl mx-auto mt-3 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-900 text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Speech recognition works best in Chrome or Edge.</p>
            <p className="text-xs text-amber-800 mt-0.5">
              You can still click <strong>Listen</strong> to hear standard native pronunciations.
            </p>
          </div>
        </div>
      )}

      {/* Word Quick Drawer / List Modal (Collapsible) */}
      {showWordList && (
        <div className="w-full max-w-xl mx-auto mt-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-700">All Words ({VOCABULARY.length})</h2>
            <button
              onClick={() => setShowWordList(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {VOCABULARY.map((item, idx) => {
              const best = bestScores[item.id];
              const isWordMastered = best !== undefined && best >= 80;
              const isCurrent = currentWord?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    const filteredIdx = filteredWords.findIndex((w) => w.id === item.id);
                    if (filteredIdx !== -1) {
                      goToWord(filteredIdx);
                    } else {
                      setSelectedCategory('All Categories');
                      const fullIdx = VOCABULARY.findIndex((w) => w.id === item.id);
                      goToWord(fullIdx);
                    }
                    setShowWordList(false);
                  }}
                  className={`p-2 rounded-xl text-left border text-xs flex flex-col justify-between transition ${
                    isCurrent
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-950 font-bold'
                      : isWordMastered
                      ? 'border-emerald-200 bg-emerald-50/50 text-slate-800'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{item.spanish}</span>
                    {isWordMastered && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate mt-1">
                    {best !== undefined ? `Best: ${best}%` : item.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="w-full max-w-xl mx-auto my-auto py-4 flex flex-col items-center">
        {/* Category Filter & Progress Bar */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-3 px-1">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="category-select" className="text-xs font-semibold text-slate-600 shrink-0">
              Category:
            </label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentIndex(0);
                resetAttemptForWord();
              }}
              className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-xs"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Progress Line */}
          <div className="text-xs font-semibold text-slate-500 tracking-wide">
            Word {currentIndex + 1} of {filteredWords.length}
          </div>
        </div>

        {/* Center Flashcard */}
        {currentWord && (
          <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden transition-all">
            {/* Top Card Badge / Status */}
            <div className="w-full flex items-center justify-between mb-4">
              <span className="inline-block px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-semibold text-amber-800 uppercase tracking-wider">
                {currentWord.category}
              </span>

              {isMastered ? (
                <div
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-300"
                  title="Mastered with score 80 or higher"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mastered ({currentBestScore}%)</span>
                </div>
              ) : currentBestScore !== undefined ? (
                <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                  Best: {currentBestScore}%
                </div>
              ) : (
                <div className="text-xs text-slate-400">Not attempted yet</div>
              )}
            </div>

            {/* Spanish Word in Large Text */}
            <div className="my-2">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight select-all">
                {currentWord.spanish}
              </h2>
              {currentWord.phoneticHint && (
                <p className="text-xs font-medium text-slate-400 mt-1 tracking-wider uppercase">
                  [{currentWord.phoneticHint}]
                </p>
              )}
            </div>

            {/* English Meaning Below It */}
            <p className="text-lg sm:text-xl font-medium text-slate-600 mt-1 mb-6">
              {currentWord.english}
            </p>

            {/* Error Message Display */}
            {errorMessage && (
              <div className="w-full mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Recording Active Banner / Pulse */}
            {isRecording && (
              <div className="w-full mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col items-center gap-2 animate-pulse">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                  <span>Listening... Speak now in Spanish</span>
                </div>
                {/* 5-second countdown indicator */}
                <div className="w-full max-w-xs bg-rose-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-600 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(recordingSecondsLeft / 5) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-rose-600">
                  Auto-stops in {recordingSecondsLeft}s (or click Stop)
                </span>
              </div>
            )}

            {/* Score Result Card */}
            {latestResult && !isRecording && (
              <div className="w-full mb-6 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center">
                {/* Large Score with color coding */}
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-5xl font-black ${
                      latestResult.bestScore >= 80
                        ? 'text-emerald-600'
                        : latestResult.bestScore >= 50
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {latestResult.bestScore}
                  </span>
                  <span className="text-lg font-semibold text-slate-400">/ 100</span>
                </div>

                {/* Score Progress Bar */}
                <div className="w-full bg-slate-200 rounded-full h-3 mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      latestResult.bestScore >= 80
                        ? 'bg-emerald-500'
                        : latestResult.bestScore >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.max(5, latestResult.bestScore)}%` }}
                  />
                </div>

                {/* "We heard: ___" */}
                <div className="mt-4 text-sm font-medium text-slate-700">
                  We heard:{' '}
                  <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 inline-block">
                    &ldquo;{latestResult.bestTranscript}&rdquo;
                  </span>
                </div>

                {/* Short English Feedback Message */}
                <p className="mt-2 text-sm font-semibold text-slate-800 text-center">
                  {latestResult.bestScore >= 80 && (
                    <span className="text-emerald-700 flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      Excellent! Great pronunciation.
                    </span>
                  )}
                  {latestResult.bestScore >= 50 && latestResult.bestScore < 80 && (
                    <span className="text-amber-700">
                      Good try! Listen again and focus on each sound.
                    </span>
                  )}
                  {latestResult.bestScore < 50 && (
                    <span className="text-rose-700">
                      Keep practicing. Tap Listen, then try again slowly.
                    </span>
                  )}
                </p>

                {/* Try Again Button */}
                <button
                  onClick={() => {
                    setLatestResult(null);
                    setErrorMessage(null);
                    startRecording();
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try again</span>
                </button>
              </div>
            )}

            {/* Core Action Buttons: Listen & Record */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Listen Button */}
              <button
                onClick={handleListen}
                disabled={isRecording}
                className={`w-full sm:w-44 py-3.5 px-5 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition shadow-sm border ${
                  isListeningVoice
                    ? 'bg-amber-100 border-amber-300 text-amber-900 ring-2 ring-amber-400'
                    : 'bg-white hover:bg-amber-50 border-slate-200 text-slate-800 hover:border-amber-300'
                } cursor-pointer active:scale-98 disabled:opacity-50`}
                title="Listen to pronunciation (Keyboard shortcut: L)"
                aria-label="Listen to word"
              >
                <Volume2 className={`w-5 h-5 ${isListeningVoice ? 'animate-bounce text-amber-700' : 'text-amber-600'}`} />
                <span>Listen</span>
              </button>

              {/* Record / Stop Button */}
              <button
                onClick={toggleRecording}
                className={`w-full sm:w-44 py-3.5 px-5 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer active:scale-98 ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 ring-4 ring-rose-200'
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-300'
                }`}
                title="Record pronunciation (Keyboard shortcut: Space)"
                aria-label={isRecording ? 'Stop recording' : 'Record pronunciation'}
              >
                {isRecording ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    <span>Record</span>
                  </>
                )}
              </button>
            </div>

            {/* "Play my recording" button (appears after recording) */}
            {recordedAudioUrl && !isRecording && (
              <div className="mt-4 pt-3 border-t border-slate-100 w-full flex justify-center">
                <button
                  onClick={handlePlayRecording}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition shadow-xs cursor-pointer ${
                    isPlayingRecordedAudio
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                  }`}
                  aria-label="Play my recording"
                >
                  {isPlayingRecordedAudio ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause recording</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play my recording</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Navigation Buttons: Previous and Next */}
            <div className="w-full flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-sm flex items-center gap-1.5 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Previous word (Keyboard shortcut: Left Arrow)"
                aria-label="Previous word"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={handleNext}
                disabled={currentIndex === filteredWords.length - 1}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-sm flex items-center gap-1.5 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Next word (Keyboard shortcut: Right Arrow)"
                aria-label="Next word"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-200/80 rounded border border-slate-300 text-slate-700 font-mono text-[10px]">
              Space
            </kbd>{' '}
            Record / Stop
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-200/80 rounded border border-slate-300 text-slate-700 font-mono text-[10px]">
              L
            </kbd>{' '}
            Listen
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-200/80 rounded border border-slate-300 text-slate-700 font-mono text-[10px]">
              &larr;
            </kbd>{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-200/80 rounded border border-slate-300 text-slate-700 font-mono text-[10px]">
              &rarr;
            </kbd>{' '}
            Previous / Next
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-xl mx-auto py-2 text-center text-xs text-slate-400">
        <p>Built with Web Speech API &bull; Mexican Spanish (es-MX) pronunciation model</p>
      </footer>
    </div>
  );
}
