import React, { useState } from 'react';

function Quiz({ quizData }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // This is a safe check. It ensures quizData is an array before trying to render.
  if (!Array.isArray(quizData) || quizData.length === 0) {
    return null;
  }

  const handleOptionClick = (questionIndex, option) => {
    setAnswers({
      ...answers,
      [questionIndex]: option,
    });
  };

  const getButtonClass = (questionIndex, option) => {
    // Show selected state even before submitting
    if (answers[questionIndex] === option && !submitted) {
      return 'selected';
    }
    
    // After submission, show correct/incorrect
    if (submitted) {
      const correctAnswer = quizData[questionIndex].answer;
      if (option === correctAnswer) return 'correct';
      if (answers[questionIndex] === option) return 'incorrect';
    }
    return '';
  };

  // Calculate score
  const getScore = () => {
    let correct = 0;
    quizData.forEach((q, index) => {
      if (answers[index] === q.answer) {
        correct++;
      }
    });
    return correct;
  };

  const getReview = () => {
    const correct = getScore();
    const total = quizData.length;
    const percentage = Math.round((correct / total) * 100);

    let stars = 1;
    let emoji = '🤗';
    let title = 'Nice Try!';
    let message = '';

    if (percentage === 100) {
      stars = 5;
      emoji = '🌟';
      title = 'Perfect Score!';
      message = "WOW! You got every single answer right! You are a reading superstar! Keep shining bright! ✨";
    } else if (percentage >= 80) {
      stars = 4;
      emoji = '⭐';
      title = 'Amazing Job!';
      message = "You did really well! Almost perfect! You understand the text so well. Keep up this great work! 🎉";
    } else if (percentage >= 60) {
      stars = 3;
      emoji = '👍';
      title = 'Good Work!';
      message = "Nice effort! You got most of them right. Try reading the text one more time and you'll do even better! 💪";
    } else if (percentage >= 40) {
      stars = 2;
      emoji = '💪';
      title = 'Keep Going!';
      message = "Good try! Reading takes practice. Try reading the text slowly and carefully, then try the quiz again. You can do it! 🌈";
    } else {
      stars = 1;
      emoji = '🤗';
      title = 'Great Start!';
      message = "Don't worry! Every reader starts somewhere. Try listening to the text with 'Read Aloud' first, then try the quiz again. You're learning! 🌟";
    }

    return { correct, total, percentage, stars, emoji, title, message };
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="quiz-container">
      <h2>📝 Let's Check Your Understanding!</h2>
      {quizData.map((q, index) => (
        <div key={index} className="quiz-question">
          <p>{index + 1}. {q.question}</p>
          <div className="quiz-options">
            {q.options.map((option, i) => (
              <button
                key={i}
                onClick={() => !submitted && handleOptionClick(index, option)}
                className={getButtonClass(index, option)}
                disabled={submitted}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}

      {!submitted && (
        <button className="btn" onClick={() => setSubmitted(true)}>
          ✅ Check Answers
        </button>
      )}

      {/* Score Review Section */}
      {submitted && (() => {
        const review = getReview();
        return (
          <div className="quiz-review-card">
            {/* Emoji & Title */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>{review.emoji}</div>
              <h2 style={{ margin: '0 0 5px 0', color: '#2d3748', fontSize: '1.8rem' }}>
                {review.title}
              </h2>
              <div style={{
                fontSize: '2.5rem', fontWeight: 'bold',
                color: review.percentage >= 60 ? '#2f855a' : review.percentage >= 40 ? '#d69e2e' : '#e53e3e'
              }}>
                {review.percentage}%
              </div>
              {/* Stars */}
              <div style={{ fontSize: '1.8rem', margin: '8px 0' }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} style={{ opacity: i < review.stars ? 1 : 0.2 }}>⭐</span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div className="quiz-stat-box" style={{ borderLeft: '4px solid #48bb78' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2f855a' }}>
                  {review.correct}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#718096' }}>Correct ✅</div>
              </div>
              <div className="quiz-stat-box" style={{ borderLeft: '4px solid #f56565' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#e53e3e' }}>
                  {review.total - review.correct}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#718096' }}>Wrong ❌</div>
              </div>
            </div>

            {/* Motivational Message */}
            <div style={{
              padding: '18px',
              borderRadius: '12px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              fontSize: '1.1rem',
              lineHeight: '1.8',
              color: '#4a5568',
              marginBottom: '15px'
            }}>
              {review.message}
            </div>

            {/* Retry Button */}
            <div style={{ textAlign: 'center' }}>
              <button className="btn" onClick={handleRetry} style={{
                background: 'linear-gradient(135deg, #68d391 0%, #48bb78 100%)',
                padding: '12px 30px'
              }}>
                🔄 Try Again
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default Quiz;