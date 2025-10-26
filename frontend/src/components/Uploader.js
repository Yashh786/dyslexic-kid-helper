import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Uploader({ onTextExtracted }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first!');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      onTextExtracted(response.data.text);
    } catch (err) {
      setError('An error occurred during upload. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="uploader-container">
      <h2>Upload an Image or PDF</h2>
      <p>Let's turn pictures of text into words you can read!</p>
      <input type="file" onChange={handleFileChange} accept="image/*,.pdf" />
      <button className="btn" onClick={handleUpload} disabled={loading}>
        {loading ? 'Reading...' : '✨ Start Reading'}
      </button>
      {loading && <div className="loader"></div>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default Uploader;