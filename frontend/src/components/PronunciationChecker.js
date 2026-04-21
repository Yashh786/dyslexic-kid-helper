import React, { useState, useEffect, useRef, useCallback } from 'react';

const PronunciationChecker = ({ originalText, isVisible }) => {
  const [isListening, setIsListening] = useState(false);
  const [wordStates, setWordStates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [review, setReview] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  const recognitionRef = useRef(null);
  const originalWords = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const wordContainerRef = useRef(null);
  const currentIndexRef = useRef(0);
  const wordStatesRef = useRef([]);
  const accumulatedTranscriptRef = useRef('');

  // Normalize a word for comparison: lowercase, remove punctuation
  const normalizeWord = useCallback((word) => {
    return word
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()[\]"'?।]/g, '')
      .trim();
  }, []);

  // Simple Levenshtein distance for fuzzy matching
  const levenshtein = useCallback((a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }, []);

  // Check if two words are similar enough (fuzzy match)
  const isSimilar = useCallback((spoken, target) => {
    if (!spoken || !target) return false;
    const s = normalizeWord(spoken);
    const t = normalizeWord(target);
    if (!s || !t) return false;
    if (s === t) return true;
    // For short words (<=3 chars), require exact match
    if (t.length <= 3) return s === t;
    // Allow 1 edit for words 4-6 chars, 2 edits for longer
    const maxDist = t.length <= 6 ? 1 : 2;
    return levenshtein(s, t) <= maxDist;
  }, [normalizeWord, levenshtein]);

  useEffect(() => {
    // Sanitize the original text: remove extra spaces and hidden characters
    const sanitizedText = originalText.replace(/\s+/g, ' ').trim();
    originalWords.current = sanitizedText.split(' ').filter(w => w.length > 0);
    const initialStates = new Array(originalWords.current.length).fill(0);
    setWordStates(initialStates);
    wordStatesRef.current = initialStates;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    setReview(null);
    setIsFinished(false);
    setElapsedTime(0);
    accumulatedTranscriptRef.current = '';
  }, [originalText]);

  // Auto-scroll to current word
  useEffect(() => {
    if (isListening && wordContainerRef.current) {
      const activeWord = wordContainerRef.current.querySelector(`[data-index="${currentIndex}"]`);
      if (activeWord) {
        activeWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentIndex, isListening]);

  const matchWords = useCallback((speechText) => {
    if (!speechText || speechText.trim() === '') return;

    const spokenWords = speechText.toLowerCase().trim().split(/\s+/);

    const nextStates = new Array(originalWords.current.length).fill(0);
    let originalIdx = 0;

    // Use a small target window since we always iterate from scratch
    const windowSize = 5;
    for (const spokenWord of spokenWords) {
      const normalizedSpoken = normalizeWord(spokenWord);
      if (!normalizedSpoken) continue;

      for (let i = 0; i < windowSize; i++) {
        const targetIdx = originalIdx + i;
        if (targetIdx >= originalWords.current.length) break;

        const targetWord = normalizeWord(originalWords.current[targetIdx]);
        if (isSimilar(normalizedSpoken, targetWord)) {
          // Fill gaps for missed words if gap is small
          for (let j = originalIdx; j <= targetIdx; j++) {
            if (nextStates[j] !== 1 && (targetIdx - j <= 2 || j === targetIdx)) {
              nextStates[j] = 1;
            }
          }
          originalIdx = targetIdx + 1;
          break;
        }
      }
    }

    if (originalIdx !== currentIndexRef.current || nextStates.some((s, i) => s !== wordStatesRef.current[i])) {
      currentIndexRef.current = originalIdx;
      wordStatesRef.current = nextStates;
      setCurrentIndex(originalIdx);
      setWordStates(nextStates);
    }

    // Auto-finish if all words are matched
    if (originalIdx >= originalWords.current.length) {
      setTimeout(() => finishTest(), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizeWord, isSimilar]);

  const generateReview = useCallback((score, totalWords, timeSeconds) => {
    const wpm = timeSeconds > 0 ? Math.round((totalWords / timeSeconds) * 60) : 0;
    const correctWords = Math.round((score / 100) * totalWords);
    const missedWords = totalWords - correctWords;

    let stars = 1;
    let message = '';
    let emoji = '';
    let performanceLevel = '';

    if (score >= 95) {
      stars = 5;
      emoji = '🌟';
      performanceLevel = 'Outstanding!';
      message = "Incredible job! You read almost perfectly! Your reading skills are amazing. Keep up the fantastic work!";
    } else if (score >= 85) {
      stars = 4;
      emoji = '⭐';
      performanceLevel = 'Great Job!';
      message = "Very well done! You read most of the text correctly. Just a few words to practice. You're doing brilliantly!";
    } else if (score >= 70) {
      stars = 3;
      emoji = '👍';
      performanceLevel = 'Good Effort!';
      message = "Nice work! You got most of the words right. Try reading a bit slower to catch the tricky words. You're improving!";
    } else if (score >= 50) {
      stars = 2;
      emoji = '💪';
      performanceLevel = 'Keep Trying!';
      message = "Good effort! Reading takes practice. Try pointing at each word as you read it. You're getting there!";
    } else {
      stars = 1;
      emoji = '🤗';
      performanceLevel = 'Nice Start!';
      message = "Great start! Every reader starts somewhere. Try reading slowly, one word at a time. You can do this!";
    }

    return {
      score,
      stars,
      emoji,
      performanceLevel,
      message,
      wpm,
      totalWords,
      correctWords,
      missedWords,
      timeSeconds: Math.round(timeSeconds)
    };
  }, []);

  const finishTest = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }
    setIsListening(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const timeSeconds = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
    const correct = wordStatesRef.current.filter(s => s === 1).length;
    const total = originalWords.current.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Mark unmatched words as red (missed)
    setWordStates(prev => prev.map(s => (s === 1 ? 1 : 2)));
    wordStatesRef.current = wordStatesRef.current.map(s => (s === 1 ? 1 : 2));

    const reviewData = generateReview(score, total, timeSeconds);
    setReview(reviewData);
    setIsFinished(true);
  }, [isListening, generateReview]);

  const startTest = () => {
    const initialStates = new Array(originalWords.current.length).fill(0);
    setWordStates(initialStates);
    wordStatesRef.current = initialStates;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    setReview(null);
    setIsFinished(false);
    setElapsedTime(0);
    accumulatedTranscriptRef.current = '';

    // Cancel any ongoing speech synthesis
    window.speechSynthesis.cancel();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser doesn't support Speech Recognition. Please use Chrome or Edge.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    const isHindi = /[\u0900-\u097F]/.test(originalText);
    rec.lang = isHindi ? 'hi-IN' : 'en-US';

    rec.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          // Also check alternative results for better matching
          for (let alt = 1; alt < event.results[i].length; alt++) {
            finalTranscript += event.results[i][alt].transcript + ' ';
          }
        } else {
          interimTranscript += transcript;
        }
      }

      // Accumulate final results permanently
      if (finalTranscript.trim()) {
        accumulatedTranscriptRef.current += ' ' + finalTranscript;
      }

      // Constantly match the entire combined timeline of recognized speech
      const fullTranscript = accumulatedTranscriptRef.current + ' ' + interimTranscript;
      if (fullTranscript.trim()) {
        matchWords(fullTranscript);
      }
    };

    rec.onerror = (event) => {
      console.error("Speech Error:", event.error);
      if (event.error === 'no-speech') {
        // Silently restart — user might just be pausing
        return;
      }
      if (event.error === 'not-allowed') {
        alert("Microphone access is blocked. Please allow microphone access and try again.");
        setIsListening(false);
      }
    };

    rec.onend = () => {
      // Auto-restart if still listening (recognition can stop mid-session)
      if (currentIndexRef.current < originalWords.current.length && !isFinished) {
        try {
          rec.start();
        } catch (e) {
          console.warn("Could not restart recognition:", e);
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = rec;

    try {
      rec.start();
      setIsListening(true);
      startTimeRef.current = Date.now();

      // Start elapsed time counter
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (e) {
      console.error("Failed to start recognition:", e);
      alert("Could not start microphone. Please make sure microphone is available.");
    }
  };

  const stopTest = () => {
    finishTest();
  };

  const resetTest = () => {
    const initialStates = new Array(originalWords.current.length).fill(0);
    setWordStates(initialStates);
    wordStatesRef.current = initialStates;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    setReview(null);
    setIsFinished(false);
    setElapsedTime(0);
    accumulatedTranscriptRef.current = '';

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) {
    return (
      <div className="simplified-container" style={{ marginTop: '30px', border: '3px dashed #cbd5e0', opacity: 0.8 }}>
        <h3 className="simplified-header" style={{ color: '#718096' }}>🔒 Practice Mode Locked</h3>
        <p>Listen to the <strong>"Read Aloud"</strong> first! 🎧</p>
      </div>
    );
  }

  return (
    <div className="simplified-container reading-test-container" style={{ marginTop: '30px', border: '3px solid #a7d8de', maxWidth: '100%' }}>
      <h3 className="simplified-header">🎙️ Reading Test</h3>
      <p style={{ fontSize: '1rem', color: '#666', marginTop: '-5px' }}>
        Read the text aloud and watch your words light up in <span style={{ color: '#2f855a', fontWeight: 'bold' }}>green</span>!
      </p>

      {/* Controls Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        margin: '15px 0',
        padding: '12px 15px',
        background: '#f7fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!isListening && !isFinished && (
            <button className="btn" onClick={startTest} style={{ margin: 0, padding: '12px 28px' }}>
              🎤 Start Reading
            </button>
          )}
          {isListening && (
            <button className="btn" style={{ backgroundColor: '#e53e3e', margin: 0, padding: '12px 28px' }} onClick={stopTest}>
              🛑 Finish Test
            </button>
          )}
          {isFinished && (
            <button className="btn" onClick={resetTest} style={{ margin: 0, padding: '12px 28px', background: 'linear-gradient(135deg, #68d391 0%, #48bb78 100%)' }}>
              🔄 Try Again
            </button>
          )}
        </div>

        {/* Status indicators */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', fontSize: '0.95rem' }}>
          {isListening && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              color: '#e53e3e', fontWeight: 'bold',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                backgroundColor: '#e53e3e', display: 'inline-block',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}></span>
              Listening...
            </span>
          )}
          {(isListening || isFinished) && (
            <span style={{ color: '#4a5568' }}>
              ⏱️ {formatTime(elapsedTime)}
            </span>
          )}
          {(isListening || isFinished) && (
            <span style={{ color: '#2f855a', fontWeight: 'bold' }}>
              {wordStates.filter(s => s === 1).length}/{originalWords.current.length} words
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(isListening || isFinished) && (
        <div style={{
          width: '100%', height: '8px', backgroundColor: '#e2e8f0',
          borderRadius: '4px', overflow: 'hidden', marginBottom: '15px'
        }}>
          <div style={{
            height: '100%',
            width: `${(wordStates.filter(s => s === 1).length / Math.max(originalWords.current.length, 1)) * 100}%`,
            backgroundColor: '#48bb78',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }}></div>
        </div>
      )}

      {/* Word Display Area */}
      <div
        ref={wordContainerRef}
        style={{
          padding: '20px',
          background: '#fff',
          borderRadius: '15px',
          textAlign: 'left',
          lineHeight: '2.8',
          fontSize: '1.4rem',
          border: isListening ? '2px solid #48bb78' : '1px solid #eee',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px 10px',
          maxHeight: '400px',
          overflowY: 'auto',
          transition: 'border-color 0.3s ease',
          position: 'relative'
        }}
      >
        {originalWords.current.map((word, index) => {
          const state = wordStates[index];
          const isCurrent = isListening && index === currentIndex;

          let bgColor = 'transparent';
          let textColor = '#333';
          let decoration = 'none';
          let fontWeight = 'normal';
          let boxShadow = 'none';

          if (state === 1) {
            // Correctly read — green
            bgColor = '#c6f6d5';
            textColor = '#22543d';
            decoration = 'none';
            fontWeight = 'bold';
          } else if (state === 2) {
            // Missed — red (only shown after test ends)
            bgColor = '#fed7d7';
            textColor = '#9b2c2c';
            decoration = 'none';
          }

          if (isCurrent) {
            boxShadow = '0 0 0 2px #48bb78';
          }

          return (
            <span
              key={index}
              data-index={index}
              style={{
                color: textColor,
                backgroundColor: bgColor,
                textDecoration: decoration,
                fontWeight: fontWeight,
                padding: '2px 6px',
                borderRadius: '6px',
                transition: 'all 0.2s ease-in-out',
                display: 'inline-block',
                boxShadow: boxShadow,
                cursor: 'default'
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Review Section */}
      {review && (
        <div style={{
          marginTop: '25px',
          padding: '25px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%)',
          border: '2px solid #38b2ac',
          animation: 'fadeInUp 0.5s ease-out'
        }}>
          {/* Score Header */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '5px' }}>{review.emoji}</div>
            <h2 style={{ margin: '0 0 5px 0', color: '#2d3748', fontSize: '1.8rem' }}>
              {review.performanceLevel}
            </h2>
            <div style={{
              fontSize: '2.5rem', fontWeight: 'bold',
              color: review.score >= 70 ? '#2f855a' : review.score >= 50 ? '#d69e2e' : '#e53e3e'
            }}>
              {review.score}%
            </div>
            {/* Stars */}
            <div style={{ fontSize: '1.8rem', margin: '8px 0' }}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} style={{ opacity: i < review.stars ? 1 : 0.25 }}>⭐</span>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '15px', borderRadius: '12px',
              background: '#fff', textAlign: 'center',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#2f855a' }}>
                {review.correctWords}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#718096' }}>Words Correct</div>
            </div>
            <div style={{
              padding: '15px', borderRadius: '12px',
              background: '#fff', textAlign: 'center',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#e53e3e' }}>
                {review.missedWords}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#718096' }}>Words Missed</div>
            </div>
            <div style={{
              padding: '15px', borderRadius: '12px',
              background: '#fff', textAlign: 'center',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#3182ce' }}>
                {review.wpm}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#718096' }}>Words/Min</div>
            </div>
            <div style={{
              padding: '15px', borderRadius: '12px',
              background: '#fff', textAlign: 'center',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#805ad5' }}>
                {formatTime(review.timeSeconds)}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#718096' }}>Total Time</div>
            </div>
          </div>

          {/* Feedback Message */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            fontSize: '1.1rem',
            lineHeight: '1.7',
            color: '#4a5568'
          }}>
            {review.message}
          </div>
        </div>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default PronunciationChecker;