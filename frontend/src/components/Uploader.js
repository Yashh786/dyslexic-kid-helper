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

    // Validate file size on frontend (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds 10MB limit. Please select a smaller file.');
      return;
    }

    // Validate file type
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp', 'image/tiff', 'application/pdf'];
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.pdf')) {
      setError('Invalid file type. Please upload an image (PNG, JPG, BMP, TIFF) or PDF.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');      console.log('Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'null');
      console.log('Token length:', token ? token.length : 0);
            if (!token) {
        setError('Session expired. Please login again.');
        setLoading(false);
        return;
      }

      console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);

      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 60000 // 60 second timeout for large files
      });

      console.log('Upload successful:', response.data);
      onTextExtracted(response.data.text);
      setFile(null);
    } catch (err) {
      console.error('Upload error details:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        fullError: err
      });

      // Better error messages
      if (err.response?.status === 401) {
        setError(`Unauthorized: ${err.response?.data?.details || 'Token invalid'}`);
      } else if (err.response?.status === 422) {
        setError('Invalid request format. Please check the file and try again.');
      } else if (err.response?.status === 413) {
        setError('File is too large. Maximum 10MB allowed.');
      } else {
        const errorMsg = err.response?.data?.error || err.message || 'An error occurred during upload. Please try again.';
        setError(errorMsg);
      }
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