import React, { useState, useEffect, useCallback } from 'react';
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
  const [hindiQuizError, setHindiQuizError] = useState(false);
  const [quizError, setQuizError] = useState(''); // replaces alert() for quiz errors

  // ── Logout handler (defined early so interceptor can reference it) ──────────
  const handleLogout = useCallback(() => {
    setCurrentProfile(null);
    setExtractedText('');
    setQuizData(null);
    setSimplifiedText('');
    setHindiQuizError(false);
    setQuizError('');
    setHasListened(false);
    setAuthMode('selector');
    localStorage.removeItem('currentProfile');
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  // ── Load profile from localStorage on mount + wire up 401 interceptor ───────
  useEffect(() => {
    const savedProfile = localStorage.getItem('currentProfile');
    const savedToken = localStorage.getItem('authToken');
    if (savedProfile && savedToken) {
      try {
        setCurrentProfile(JSON.parse(savedProfile));
        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } catch (err) {
        localStorage.removeItem('currentProfile');
        localStorage.removeItem('authToken');
      }
    }

    // Global 401 interceptor — auto-logout when token expires so the user
    // sees the login screen instead of silent failures.
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          handleLogout();
        }
        return Promise.reject(error);
      }
    );

    // Clean up interceptor on unmount
    return () => axios.interceptors.response.eject(interceptorId);
  }, [handleLogout]);

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


  const handleTextExtracted = (text) => {
    setExtractedText(text);
    setQuizData(null);
    setSimplifiedText('');
    setHindiQuizError(false);
    setQuizError('');
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
    // Check for Hindi text before sending request
    const containsHindi = /[\u0900-\u097F]/.test(text);
    if (containsHindi) {
      setHindiQuizError(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoadingQuiz(true);
    setQuizData(null);
    setQuizError('');
    setHindiQuizError(false);

    // Scroll down to the loading indicator
    setTimeout(() => {
      const loadingEl = document.getElementById('quiz-loading-section');
      if (loadingEl) {
        loadingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollBy({ top: 400, behavior: 'smooth' });
      }
    }, 100);

    try {
      const response = await axios.post(`${API_URL}/api/quiz`, { text });

      // Check if response is a valid array of quiz questions
      if (Array.isArray(response.data) && response.data.length > 0) {
        setQuizData(response.data);
        // Scroll to quiz after a short delay to ensure rendering
        setTimeout(() => {
          const quizElement = document.querySelector('.quiz-container');
          if (quizElement) {
            quizElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      } else {
        setQuizError('Quiz generation returned an unexpected format. Please try again.');
      }
    } catch (error) {
      if (error.response) {
        const errorMsg = error.response.data?.error || 'Server error occurred';
        setQuizError(`Could not generate quiz: ${errorMsg}`);
      } else if (error.request) {
        setQuizError('No response from server. Please check your connection.');
      } else {
        setQuizError('An error occurred while preparing the quiz request.');
      }
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

            {/* --- HINDI QUIZ ERROR BOX --- */}
            {hindiQuizError && (
              <div className="simplified-container" style={{ border: '2px solid #ffcc00', background: '#fff9e6', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="simplified-header" style={{ color: '#d4a017' }}>⚠️ Oops!</span>
                  <button
                    onClick={() => setHindiQuizError(false)}
                    style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
                  >
                    ✖
                  </button>
                </div>
                <p style={{ fontSize: '1.2rem', lineHeight: '1.8' }}>
                  Quiz generation for Hindi text is not available right now. We are working on adding it soon! ✨
                </p>
              </div>
            )}

            <Reader
              text={extractedText}
              onGenerateQuiz={handleGenerateQuiz}
              onSimplify={handleSimplifyResult}
              onReadAloudStarted={handleReadAloudStarted}
              isGeneratingQuiz={loadingQuiz}
            />

            {/* --- PRONUNCIATION CHECKER --- */}
            <PronunciationChecker
              originalText={extractedText}
              isVisible={hasListened}
            />

            {loadingQuiz && (
              <div id="quiz-loading-section" className="quiz-loading-overlay">
                <div className="quiz-loading-card">
                  <div className="quiz-loading-icon">📚</div>
                  <div className="loader"></div>
                  <h3 style={{ color: '#4a5568', margin: '15px 0 8px 0' }}>Creating Your Quiz...</h3>
                  <p style={{ color: '#718096', fontSize: '1.1rem', margin: 0 }}>
                    🤔 Reading through the text and making fun questions just for you!
                  </p>
                  <p style={{ color: '#a0aec0', fontSize: '0.9rem', marginTop: '10px' }}>
                    This may take a moment — hang tight! ✨
                  </p>
                </div>
              </div>
            )}
            {quizData && <Quiz quizData={quizData} />}

            {/* --- QUIZ ERROR BOX (replaces alert()) --- */}
            {quizError && (
              <div className="simplified-container" style={{ border: '2px solid #fc8181', background: '#fff5f5', marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="simplified-header" style={{ color: '#c53030' }}>⚠️ Quiz Error</span>
                  <button
                    onClick={() => setQuizError('')}
                    style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
                  >
                    ✖
                  </button>
                </div>
                <p style={{ fontSize: '1.1rem', lineHeight: '1.8', color: '#742a2a' }}>{quizError}</p>
              </div>
            )}
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