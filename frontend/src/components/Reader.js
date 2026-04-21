import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Reader({ text, onGenerateQuiz, onSimplify, onReadAloudStarted, isGeneratingQuiz }) {
  const [displayedText, setDisplayedText] = useState(text);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, word: '', content: '' });
  
  const voicesRef = useRef([]);

  useEffect(() => {
    setDisplayedText(text);
    setIsSpeaking(false);
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

  // --- FIX 1: GET DEFINITION LOGIC ---
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

  // --- FIX 2: SIMPLIFY SELECTION LOGIC ---
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

  const handleSpeak = () => {
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      setDisplayedText(text);
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

      utterance.onboundary = (event) => {
        if (event.name === 'word' && !isHindi) { 
          const wordStart = event.charIndex;
          let wordEnd = text.indexOf(' ', wordStart);
          if (wordEnd === -1) wordEnd = text.length;

          setDisplayedText(
            <>
              {text.substring(0, wordStart)}
              <span className="highlight">{text.substring(wordStart, wordEnd)}</span>
              {text.substring(wordEnd)}
            </>
          );
        }
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setDisplayedText(text);
      };

      utterance.onerror = (e) => {
        console.error("Speech Error:", e);
        setIsSpeaking(false);
        setDisplayedText(text);
        if (e.error === 'not-allowed') {
          alert("Browser blocked audio. Please click anywhere on the page first, then try again!");
        }
      };

      window.speechSynthesis.speak(utterance);
    }, 200);
  };

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
          onMouseUp={handleSelection} // Trigger definition on highlight
          style={{ textAlign: 'left', lineHeight: '2.5', whiteSpace: 'pre-wrap', fontSize: '1.4rem' }}
        >
            {displayedText}
        </div>
    </div>
  );
}

export default Reader;