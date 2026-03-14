import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Reader({ text, onGenerateQuiz, onSimplify }) {
  const [displayedText, setDisplayedText] = useState(text);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, word: '', content: '' });

  useEffect(() => {
    setDisplayedText(text);
    setIsSpeaking(false);
    window.speechSynthesis.cancel();
  }, [text]);

  // --- 1. Selection Logic (Meaning triggers on selection) ---
  const handleSelection = async () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim().replace(/[^a-zA-Z]/g, "");
    
    if (selectedText.length > 2) {
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

  // --- 2. Auto-Hide Logic (Gone when mouse moves) ---
  const handleMouseMove = () => {
    if (tooltip.visible) {
      setTooltip({ visible: false, word: '', content: '' });
      // Clear the selection so the text doesn't stay highlighted
      window.getSelection().removeAllRanges();
    }
  };

  const handleSpeak = () => {
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

  const handleSimplify = async () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText) {
      try {
        const response = await axios.post(`${API_URL}/api/simplify`, { text: selectedText });
        onSimplify(response.data.simplified_text); 
      } catch (error) {
        console.error("Simplification error:", error);
      }
    }
  };

  return (
    // Added onMouseMove here to trigger the hide logic
    <div className="reader-container" onMouseMove={handleMouseMove}>
      {tooltip.visible && (
        <div className="modal-overlay">
          <div className="definition-card">
            <h3 style={{ color: '#ffcc00', marginTop: 0 }}>{tooltip.word}</h3>
            <p>{tooltip.content}</p>
          </div>
        </div>
      )}

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

      <div 
        className="text-content" 
        onMouseUp={handleSelection}
        style={{ textAlign: 'left', lineHeight: '2', whiteSpace: 'pre-wrap' }}
      >
        {displayedText}
      </div>
    </div>
  );
}

export default Reader;