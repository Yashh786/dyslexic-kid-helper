// The filename is: frontend/src/components/Reader.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Note the new "onSimplify" prop
function Reader({ text, onGenerateQuiz, onSimplify }) {
  const [displayedText, setDisplayedText] = useState(text);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, content: '' });

  useEffect(() => {
    setDisplayedText(text);
    setIsSpeaking(false);
    window.speechSynthesis.cancel();
  }, [text]);

  const handleSpeak = () => {
    // ... (This function remains unchanged)
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setDisplayedText(text);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const wordStart = event.charIndex;
        let wordEnd = text.indexOf(' ', wordStart);
        if (wordEnd === -1) { wordEnd = text.length; }
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
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };
  
  const handleSelection = async () => {
    // ... (This function remains unchanged)
    const selection = window.getSelection();
    const selectedText = selection.toString().trim().replace(/[^a-zA-Z]/g, "");
    if (selectedText.length > 2) {
      try {
        const response = await axios.post(`${API_URL}/api/define`, { word: selectedText });
        setTooltip({ visible: true, content: response.data.definition });
      } catch (error) { console.error("Definition error:", error); }
    }
  };

  const handleMouseMove = () => {
    if (tooltip.visible) {
      setTooltip({ visible: false, content: '' });
    }
  };
  
  const handleSimplify = async () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText) {
          try {
              const response = await axios.post(`${API_URL}/api/simplify`, { text: selectedText });
              const simplified = response.data.simplified_text;
              // --- THIS IS THE CHANGE ---
              // Instead of alert(), call the onSimplify prop from App.js
              onSimplify(simplified);
          } catch (error) {
              console.error("Simplification error:", error);
              alert("Sorry, I couldn't simplify that text.");
          }
      } else {
          alert("Please select a paragraph to simplify!");
      }
  };

  return (
    <div className="reader-container" onMouseMove={handleMouseMove}>
      {tooltip.visible && (<div className="tooltip">{tooltip.content}</div>)}
      <div className="reader-toolbar">
        <button className="btn" onClick={handleSpeak}>
          {isSpeaking ? '🛑 Stop' : '▶️ Read Aloud'}
        </button>
        <button className="btn" onClick={handleSimplify}>
          🪄 Simplify Selection
        </button>
        <button className="btn" onClick={() => onGenerateQuiz(text)}>
          ❓ Generate Quiz
        </button>
      </div>
      <div className="text-content" onMouseUp={handleSelection}>
        {displayedText}
      </div>
    </div>
  );
}

export default Reader;