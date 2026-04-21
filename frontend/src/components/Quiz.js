import React, { useState } from 'react';

function Quiz({ quizData }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // --- THIS IS THE FIX ---
  // This is a much safer check. It ensures quizData is an array before trying to render.
  // If it's not an array (e.g., an error object or null), it will render nothing.
  if (!Array.isArray(quizData) || quizData.length === 0) {
    return null; // Don't render anything if data is not a valid array
  }
  // --- END OF FIX ---

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

  return (
    <div className="quiz-container">
      <h2>Let's Check Your Understanding!</h2>
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
          Check Answers
        </button>
      )}
    </div>
  );
}

export default Quiz;