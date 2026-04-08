import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

import Header from './components/Header';
import Login from './components/Login';
import Uploader from './components/Uploader';
import Reader from './components/Reader';
import Quiz from './components/Quiz';
import PronunciationChecker from './components/PronunciationChecker';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  
  // Tracks if the user has listened to the audio to unlock Practice Mode
  const [hasListened, setHasListened] = useState(false);
  
  // State for the AI-generated simplified text
  const [simplifiedText, setSimplifiedText] = useState('');

  const handleLoginSuccess = (userData) => { setUser(userData); };
  
  const handleLogout = () => { 
    setUser(null); 
    setExtractedText(''); 
    setQuizData(null); 
    setSimplifiedText(''); 
    setHasListened(false);
  };

  const handleTextExtracted = (text) => { 
    setExtractedText(text); 
    setQuizData(null); 
    setSimplifiedText(''); 
    setHasListened(false); 
  };

  // Triggered when "Read Aloud" starts in Reader.js
  const handleReadAloudStarted = () => {
    setHasListened(true);
  };

  // Handles the result from the "Simplify Selection" button
  const handleSimplifyResult = (text) => {
    setSimplifiedText(text);
    // Smooth scroll to top so the child sees the new simplified box
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleGenerateQuiz = async (text) => {
    setLoadingQuiz(true);
    setQuizData(null);
    try {
      const response = await axios.post(`${API_URL}/api/quiz`, { text });
      if (response.data && response.data.error) {
        alert(`Could not generate quiz: ${response.data.error}`);
      } else { 
        setQuizData(response.data); 
      }
    } catch (error) {
      console.error("Quiz generation error", error);
      alert("An error occurred while generating the quiz.");
    } finally { 
      setLoadingQuiz(false); 
    }
  };

  if (!user) { return <Login onLoginSuccess={handleLoginSuccess} />; }

  return (
    <div className="App">
      <div className="main-container">
        <Header user={user} onLogout={handleLogout} />
        
        {!extractedText ? (
          <Uploader onTextExtracted={handleTextExtracted} />
        ) : (
          <>
            <button className='btn' onClick={() => setExtractedText('')} style={{ marginBottom: '20px' }}>
              &#8592; Upload New File
            </button>
            
            {/* --- THE SIMPLIFIED BOX --- */}
            {simplifiedText && (
              <div className="simplified-container" style={{ border: '2px solid #ffcc00', background: '#fff9e6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="simplified-header" style={{ color: '#d4a017' }}>🌟 A Simpler Version for You:</span>
                  <button 
                    onClick={() => setSimplifiedText('')} 
                    style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
                  >
                    ✖
                  </button>
                </div>
                <p style={{ fontSize: '1.2rem', lineHeight: '1.8' }}>{simplifiedText}</p>
              </div>
            )}

            <Reader 
              text={extractedText} 
              onGenerateQuiz={handleGenerateQuiz}
              onSimplify={handleSimplifyResult} // Fixed: Correctly passes simplification handler
              onReadAloudStarted={handleReadAloudStarted}
            />

            {/* --- PRONUNCIATION CHECKER --- */}
            <PronunciationChecker 
              originalText={extractedText} 
              isVisible={hasListened} 
            />

            {loadingQuiz && <div className="loader"></div>}
            {quizData && <Quiz quizData={quizData} />}
          </>
        )}

        {/* Footer info */}
        <div style={{marginTop: '60px', padding: '20px', borderTop: '1px solid #eee', color: '#888'}}>
          <p><i>Dyslexic Kid Helper - v2.0 (Bilingual Support Active)</i></p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button className='btn' disabled>📷 AR Mode</button>
            <button className='btn' style={{ opacity: 1, cursor: 'default' }}>🌐 Hindi/English Active</button>
            {user.role === 'parent' && <button className='btn' disabled>📊 Parent Dashboard</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;