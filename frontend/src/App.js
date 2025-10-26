// The filename is: frontend/src/App.js

import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

import Header from './components/Header';
import Login from './components/Login';
import Uploader from './components/Uploader';
import Reader from './components/Reader';
import Quiz from './components/Quiz';
import Modal from './components/Modal'; // Import the new Modal component

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  // --- NEW STATE FOR THE MODAL ---
  const [modalContent, setModalContent] = useState({ isOpen: false, text: '' });

  const handleLoginSuccess = (userData) => { setUser(userData); };
  const handleLogout = () => { setUser(null); setExtractedText(''); setQuizData(null); };
  const handleTextExtracted = (text) => { setExtractedText(text); setQuizData(null); };

  // --- NEW FUNCTION TO OPEN THE MODAL ---
  const handleOpenModal = (text) => {
    setModalContent({ isOpen: true, text: `Simpler Version:\n\n${text}` });
  };
  
  const handleGenerateQuiz = async (text) => {
    // ... (This function remains unchanged)
    setLoadingQuiz(true);
    setQuizData(null);
    try {
      const response = await axios.post(`${API_URL}/api/quiz`, { text });
      if (response.data && response.data.error) {
        alert(`Could not generate quiz: ${response.data.error}`);
        setQuizData(null);
      } else { setQuizData(response.data); }
    } catch (error) {
      console.error("Quiz generation error", error);
      let errorMessage = "An error occurred while communicating with the server.";
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = `Server Error: ${error.response.data.error}`;
      }
      alert(errorMessage);
    } finally { setLoadingQuiz(false); }
  };

  if (!user) { return <Login onLoginSuccess={handleLoginSuccess} />; }

  return (
    <div className="App">
      {/* --- RENDER THE MODAL --- */}
      <Modal 
        isOpen={modalContent.isOpen} 
        onClose={() => setModalContent({ isOpen: false, text: '' })}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{modalContent.text}</div>
      </Modal>

      <div className="main-container">
        <Header user={user} onLogout={handleLogout} />
        {!extractedText ? (
          <Uploader onTextExtracted={handleTextExtracted} />
        ) : (
          <>
            <button className='btn' onClick={() => setExtractedText('')}>&#8592; Upload New File</button>
            {/* --- PASS THE NEW FUNCTION AS A PROP --- */}
            <Reader 
              text={extractedText} 
              onGenerateQuiz={handleGenerateQuiz}
              onSimplify={handleOpenModal}
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