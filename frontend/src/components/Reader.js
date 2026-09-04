import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Reader({ text, onGenerateQuiz, onSimplify, onReadAloudStarted, isGeneratingQuiz }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [tooltip, setTooltip] = useState({ visible: false, word: '', content: '' });
  
  const voicesRef = useRef([]);
  const utteranceRef = useRef(null);

  // Split text into words for span-based rendering
  const words = useMemo(() => {
    if (!text) return [];
    // Split on whitespace, preserving the structure
    return text.split(/(\s+)/).filter(segment => segment.length > 0);
  }, [text]);

  // Build a mapping from charIndex -> word index (for onboundary)
  const charToWordIndex = useMemo(() => {
    const mapping = {};
    let charPos = 0;
    words.forEach((segment, idx) => {
      for (let i = 0; i < segment.length; i++) {
        mapping[charPos + i] = idx;
      }
      charPos += segment.length;
    });
    return mapping;
  }, [words]);

  useEffect(() => {
    setIsSpeaking(false);
    setActiveWordIndex(-1);
    window.speechSynthesis.cancel();

    const updateVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [text]);

  // --- GET DEFINITION LOGIC ---
  const handleSelection = async () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim().replace(/[^a-zA-Z\u0900-\u097F]/g, "");
    
    if (selectedText.length > 1) {
      try {
        const response = await axios.post(`${API_URL}/api/define`, { word: selectedText });
        setTooltip({ 
          visible: true, 
          word: selectedText, 
          content: response.data.definition 
        });
      } catch (error) {
        console.error("Definition error:", error);
      }
    }
  };

  // --- SIMPLIFY SELECTION LOGIC ---
  const handleSimplifyInternal = async () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText) {
      try {
        const response = await axios.post(`${API_URL}/api/simplify`, { text: selectedText });
        onSimplify(response.data.simplified_text); 
      } catch (e) {
        console.error("Simplification error:", e);
      }
    }
  };

  const handleSpeak = useCallback(() => {
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      setActiveWordIndex(-1);
      return;
    }

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const isHindi = /[\u0900-\u097F]/.test(text);
      
      const currentVoices = window.speechSynthesis.getVoices();
      
      if (isHindi) {
        utterance.lang = 'hi-IN';
        const hindiVoice = currentVoices.find(v => v.name.includes('Google') && v.lang.includes('hi')) || 
                           currentVoices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
        if (hindiVoice) utterance.voice = hindiVoice;
        utterance.rate = 0.8; 
      } else {
        utterance.lang = 'en-US';
        const premiumEnglish = currentVoices.find(v => v.name.includes('Google') && v.lang.includes('en-US')) || 
                               currentVoices.find(v => v.name.includes('David')) ||
                               currentVoices.find(v => v.lang.startsWith('en'));
        
        if (premiumEnglish) utterance.voice = premiumEnglish;
        
        utterance.rate = 0.9;  
        utterance.pitch = 1.1; 
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (onReadAloudStarted) onReadAloudStarted();
      };

      // Word highlighting using onboundary — works for both English and Hindi
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const charIdx = event.charIndex;
          // Find which word index this character belongs to
          const wordIdx = charToWordIndex[charIdx];
          if (wordIdx !== undefined) {
            setActiveWordIndex(wordIdx);
          }
        }
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setActiveWordIndex(-1);
      };

      utterance.onerror = (e) => {
        console.error("Speech Error:", e);
        setIsSpeaking(false);
        setActiveWordIndex(-1);
        if (e.error === 'not-allowed') {
          alert("Browser blocked audio. Please click anywhere on the page first, then try again!");
        }
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }, 200);
  }, [isSpeaking, text, onReadAloudStarted, charToWordIndex]);

  return (
    <div 
      className="reader-container" 
      onMouseMove={() => tooltip.visible && setTooltip({visible:false, word:'', content:''})}
    >
        {/* CENTERED DEFINITION POPUP */}
        {tooltip.visible && (
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 1000, background: 'white', padding: '20px', borderRadius: '15px',
            boxShadow: '0 8px 25px rgba(0,0,0,0.2)', border: '3px solid #ffcc00', textAlign: 'center'
          }}>
            <h3 style={{ color: '#ffcc00', marginTop: 0 }}>{tooltip.word}</h3>
            <p style={{ color: '#333', fontSize: '1.1rem' }}>{tooltip.content}</p>
          </div>
        )}

        <div className="reader-toolbar">
            <button className="btn" onClick={handleSpeak} disabled={isGeneratingQuiz}>
                {isSpeaking ? '🛑 Stop' : '▶️ Read Aloud'}
            </button>
            <button className="btn" onClick={handleSimplifyInternal} disabled={isGeneratingQuiz}>🪄 Simplify Selection</button>
            <button className="btn" onClick={() => onGenerateQuiz(text)} disabled={isGeneratingQuiz} title={isGeneratingQuiz ? "Loading quiz..." : "Generate Quiz"}>
                {isGeneratingQuiz ? '⏳ Generating...' : '❓ Generate Quiz'}
            </button>
        </div>
        <div 
          className="text-content" 
          onMouseUp={handleSelection}
          style={{ textAlign: 'left', lineHeight: '2.5', whiteSpace: 'pre-wrap', fontSize: '1.4rem' }}
        >
            {words.map((segment, index) => {
              // Whitespace segments — render as-is
              if (/^\s+$/.test(segment)) {
                return <span key={index}>{segment}</span>;
              }
              // Word segments — highlight if active
              const isActive = isSpeaking && index === activeWordIndex;
              return (
                <span
                  key={index}
                  className={`word-span ${isActive ? 'word-highlight' : ''}`}
                  data-word-index={index}
                >
                  {segment}
                </span>
              );
            })}
        </div>
    </div>
  );
}

export default Reader;