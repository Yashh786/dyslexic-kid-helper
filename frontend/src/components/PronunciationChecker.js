import React, { useState, useEffect, useRef } from 'react';

const PronunciationChecker = ({ originalText, isVisible }) => {
  const [isListening, setIsListening] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [wordStates, setWordStates] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const recognitionRef = useRef(null);
  const originalWords = useRef([]);

  useEffect(() => {
    // Sanitize the original text: remove extra spaces and hidden characters
    const sanitizedText = originalText.replace(/\s+/g, ' ').trim();
    originalWords.current = sanitizedText.split(' ');
    setWordStates(new Array(originalWords.current.length).fill(0));

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true; 
      
      const isHindi = /[\u0900-\u097F]/.test(sanitizedText);
      rec.lang = isHindi ? 'hi-IN' : 'en-US';

      rec.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        // Clean the incoming speech to match our target words better
        matchWords(transcript.toLowerCase().trim());
      };

      rec.onerror = (event) => console.error("Speech Error:", event.error);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, [originalText]);

  const matchWords = (speech) => {
    setWordStates(prevStates => {
      const nextStates = [...prevStates];
      let newIndex = currentIndex;

      // Logic: Look through the 5-word window
      for (let i = 0; i < 5; i++) {
        const targetIdx = newIndex + i;
        if (targetIdx >= originalWords.current.length) break;

        const targetWord = originalWords.current[targetIdx]
          .toLowerCase()
          .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

        // Check if the target word exists anywhere in the current speech buffer
        if (speech.includes(targetWord)) {
          nextStates[targetIdx] = 1; // Green
          
          // Move the window pointer only if we found a match at or beyond our current spot
          if (targetIdx >= newIndex) {
            newIndex = targetIdx + 1;
          }
        }
      }

      if (newIndex !== currentIndex) setCurrentIndex(newIndex);
      return nextStates;
    });
  };

  const startTest = () => {
    setWordStates(new Array(originalWords.current.length).fill(0));
    setCurrentIndex(0);
    setAccuracy(null);
    setIsListening(true);
    if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) { window.speechSynthesis.cancel(); }
    }
  };

  const stopTest = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);

      const correct = wordStates.filter(s => s === 1).length;
      const score = Math.round((correct / originalWords.current.length) * 100);
      setAccuracy(score);
      setWordStates(prev => prev.map(s => (s === 1 ? 1 : 2)));
    }
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
    <div className="simplified-container" style={{ marginTop: '30px', border: '3px solid #a7d8de', maxWidth: '100%' }}>
      <h3 className="simplified-header">🎙️ Reading Test</h3>
      
      <div style={{ margin: '20px 0' }}>
        {!isListening ? (
          <button className="btn" onClick={startTest}>🎤 Start</button>
        ) : (
          <button className="btn" style={{ backgroundColor: '#ff4d4d' }} onClick={stopTest}>🛑 Result</button>
        )}
      </div>

      {/* FIXED BOX: Added flex-wrap and overflow control to keep words inside */}
      <div style={{ 
        padding: '20px', 
        background: '#fff', 
        borderRadius: '15px', 
        textAlign: 'left',
        lineHeight: '2.5', 
        fontSize: '1.4rem', 
        border: '1px solid #eee',
        display: 'flex', 
        flexWrap: 'wrap', // Keeps words inside the window
        gap: '2px 10px',  // Better spacing
        maxHeight: '400px', // Optional: adds a scroll if text is too long
        overflowY: 'auto'
      }}>
        {originalWords.current.map((word, index) => (
          <span key={index} style={{
            color: wordStates[index] === 1 ? '#2f855a' : (wordStates[index] === 2 ? '#c53030' : '#333'),
            textDecoration: wordStates[index] === 1 ? 'underline 4px solid #48bb78' : (wordStates[index] === 2 ? 'underline 4px solid #f56565' : 'none'),
            padding: '2px 4px',
            borderRadius: '4px',
            transition: 'all 0.1s ease-in-out',
            display: 'inline-block' // Ensures matras don't get cut off
          }}>
            {word}
          </span>
        ))}
      </div>

      {accuracy !== null && (
        <div style={{ marginTop: '25px', padding: '15px', borderRadius: '15px', background: '#e6fffa', border: '2px solid #38b2ac' }}>
          <h2 style={{ margin: 0 }}>Accuracy: {accuracy}%</h2>
        </div>
      )}
    </div>
  );
};

export default PronunciationChecker;