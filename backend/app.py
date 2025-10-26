from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from dotenv import load_dotenv

from ocr_processor import process_file
from ai_services import get_word_definition, simplify_paragraph, generate_quiz

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Simple in-memory user store for demonstration
# In a real app, use a database and hashed passwords
users = {
    "parent": "parent123",
    "kid": "kid123"
}

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username in users and users[username] == password:
        # Determine role based on username for this simple case
        role = 'parent' if 'parent' in username else 'kid'
        return jsonify({"message": "Login successful", "role": role}), 200
    else:
        return jsonify({"message": "Invalid credentials"}), 401


@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Process the file for OCR
        extracted_text = process_file(filepath)
        
        # Clean up the uploaded file
        os.remove(filepath)
        
        return jsonify({'text': extracted_text})

@app.route('/api/define', methods=['POST'])
def define_word():
    data = request.json
    word = data.get('word')
    if not word:
        return jsonify({'error': 'Word not provided'}), 400
    definition = get_word_definition(word)
    return jsonify({'definition': definition})

@app.route('/api/simplify', methods=['POST'])
def simplify_text():
    data = request.json
    text = data.get('text')
    if not text:
        return jsonify({'error': 'Text not provided'}), 400
    simplified_text = simplify_paragraph(text)
    return jsonify({'simplified_text': simplified_text})

@app.route('/api/quiz', methods=['POST'])
def create_quiz():
    data = request.json
    text = data.get('text')
    if not text:
        return jsonify({'error': 'Text not provided'}), 400
    quiz_data = generate_quiz(text)
    return jsonify(quiz_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)