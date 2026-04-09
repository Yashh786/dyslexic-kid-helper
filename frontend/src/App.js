import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

import Header from './components/Header';
import Uploader from './components/Uploader';
import Reader from './components/Reader';
import Quiz from './components/Quiz';
import PronunciationChecker from './components/PronunciationChecker';
import ProfileSelector from './components/ProfileSelector';
import ProfileCreator from './components/ProfileCreator';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [currentProfile, setCurrentProfile] = useState(null);
  const [authMode, setAuthMode] = useState('selector'); // 'selector' or 'creator'
  const [extractedText, setExtractedText] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [simplifiedText, setSimplifiedText] = useState('');

  // Load profile from localStorage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('currentProfile');
    const savedToken = localStorage.getItem('authToken');
    if (savedProfile && savedToken) {
      try {
        setCurrentProfile(JSON.parse(savedProfile));
        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } catch (err) {
        console.error('Error loading saved profile:', err);
        localStorage.removeItem('currentProfile');
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  const handleProfileSelected = ({ token, profile }) => {
    setCurrentProfile(profile);
    localStorage.setItem('currentProfile', JSON.stringify(profile));
    localStorage.setItem('authToken', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const handleProfileCreated = ({ token, profile }) => {
    setCurrentProfile(profile);
    localStorage.setItem('currentProfile', JSON.stringify(profile));
    localStorage.setItem('authToken', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const handleLogout = () => {
    setCurrentProfile(null);
    setExtractedText('');
    setQuizData(null);
    setSimplifiedText('');
    setHasListened(false);
    setAuthMode('selector');
    localStorage.removeItem('currentProfile');
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
  };

  const handleTextExtracted = (text) => {
    setExtractedText(text);
    setQuizData(null);
    setSimplifiedText('');
    setHasListened(false);
  };

  const handleReadAloudStarted = () => {
    setHasListened(true);
  };

  const handleSimplifyResult = (text) => {
    setSimplifiedText(text);
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

  // Authentication screen
  if (!currentProfile) {
    if (authMode === 'creator') {
      return (
        <ProfileCreator
          onProfileCreated={handleProfileCreated}
          onBackToSelector={() => setAuthMode('selector')}
        />
      );
    }
    return (
      <ProfileSelector
        onProfileSelected={handleProfileSelected}
        onCreateNewProfile={() => setAuthMode('creator')}
      />
    );
  }

  // Main app
  return (
    <div className="App">
      <div className="main-container">
        <Header profile={currentProfile} onLogout={handleLogout} />

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
              onSimplify={handleSimplifyResult}
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
        <div style={{ marginTop: '60px', padding: '20px', borderTop: '1px solid #eee', color: '#888' }}>
          <p><i>LexiRead - Reading Made Easy</i></p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button className='btn' disabled>📷 AR Mode</button>
            <button className='btn' style={{ opacity: 1, cursor: 'default' }}>🌐 Hindi/English Active</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;