import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

import Header from './components/Header';
import Login from './components/Login';
import Uploader from './components/Uploader';
import Reader from './components/Reader';
import Quiz from './components/Quiz';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  
  // --- UPDATED STATE FOR SIMPLIFIED TEXT ---
  // We use a simple string state to show/hide the box
  const [simplifiedText, setSimplifiedText] = useState('');

  const handleLoginSuccess = (userData) => { setUser(userData); };
  const handleLogout = () => { setUser(null); setExtractedText(''); setQuizData(null); setSimplifiedText(''); };
  const handleTextExtracted = (text) => { setExtractedText(text); setQuizData(null); setSimplifiedText(''); };

  // --- NEW FUNCTION TO HANDLE SIMPLIFICATION ---
  const handleSimplifyResult = (text) => {
    setSimplifiedText(text);
    // Optional: scroll smoothly to the simplified box
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleGenerateQuiz = async (text) => {
    setLoadingQuiz(true);
    setQuizData(null);
    try {
      const response = await axios.post(`${API_URL}/api/quiz`, { text });
      if (response.data && response.data.error) {
        alert(`Could not generate quiz: ${response.data.error}`);
      } else { setQuizData(response.data); }
    } catch (error) {
      console.error("Quiz generation error", error);
      alert("An error occurred while generating the quiz.");
    } finally { setLoadingQuiz(false); }
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
            <button className='btn' onClick={() => setExtractedText('')}>&#8592; Upload New File</button>
            
            {/* --- THE NEW SIMPLIFIED BOX --- */}
            {/* This uses the .simplified-container class from your CSS */}
            {simplifiedText && (
              <div className="simplified-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="simplified-header">🌟 A Simpler Version for You:</span>
                  <button 
                    onClick={() => setSimplifiedText('')} 
                    style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
                  >
                    ✖
                  </button>
                </div>
                <p>{simplifiedText}</p>
              </div>
            )}

            <Reader 
              text={extractedText} 
              onGenerateQuiz={handleGenerateQuiz}
              onSimplify={handleSimplifyResult}
            />

            {loadingQuiz && <div className="loader"></div>}
            {quizData && <Quiz quizData={quizData} />}
          </>
        )}

        <div style={{marginTop: '40px', color: '#888'}}>
          <p><i>Future Features (Coming Soon!)</i></p>
          <button className='btn' disabled>📷 AR Mode</button>
          <button className='btn' disabled>🌐 Multilingual Support</button>
          {user.role === 'parent' && <button className='btn' disabled>📊 Parent Dashboard</button>}
        </div>
      </div>
    </div>
  );
}

export default App;