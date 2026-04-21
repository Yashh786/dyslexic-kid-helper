from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from dotenv import load_dotenv

from db_models import db, Profile
from ocr_processor import process_file
from ai_services import get_word_definition, simplify_paragraph, generate_quiz

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Enable CORS with proper headers for JWT
CORS(app, 
     resources={r"/api/*": {
         "origins": "*",
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type", "Authorization"],
         "supports_credentials": False,
         "max_age": 3600
     }}
)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///profiles.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# JWT configuration
# Use consistent secret key - generate once and store in .env
jwt_secret = os.getenv('JWT_SECRET_KEY', 'dyslexic-kid-helper-secret-key-2024')
app.config['JWT_SECRET_KEY'] = jwt_secret
print(f"[OK] JWT Secret Key Set: {jwt_secret[:20]}...")

# Initialize database and JWT
db.init_app(app)
jwt = JWTManager(app)

# JWT error handlers with detailed logging
@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"[ERROR] Invalid token error: {error}")
    return jsonify({'error': 'Invalid token', 'details': str(error)}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_data):
    print("[ERROR] Token expired")
    return jsonify({'error': 'Token expired'}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    print(f"[ERROR] Unauthorized: {error}")
    return jsonify({'error': 'Unauthorized', 'details': str(error)}), 401

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Create database tables on startup
with app.app_context():
    db.create_all()

# ======================== DEBUG ENDPOINTS ========================

@app.route('/api/debug/jwt', methods=['GET'])
def debug_jwt():
    """Debug endpoint to check JWT configuration"""
    return jsonify({
        'jwt_secret_key': app.config['JWT_SECRET_KEY'][:20] + '...',
        'secret_full_length': len(app.config['JWT_SECRET_KEY']),
        'flask_env': os.getenv('FLASK_ENV', 'not set'),
        'debug_mode': app.debug
    }), 200

@app.route('/api/debug/token', methods=['POST'])
def debug_token():
    """Debug endpoint to validate a token"""
    from flask_jwt_extended import verify_jwt_in_request
    try:
        verify_jwt_in_request()
        current_user = get_jwt_identity()
        return jsonify({'valid': True, 'user_id': current_user}), 200
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 401

# Middleware to log all requests
@app.before_request
def log_request():
    auth_header = request.headers.get('Authorization', 'No Authorization header')
    print(f"\n{'='*60}")
    print(f"[REQUEST] {request.method} {request.path}")
    print(f"[AUTH] Header: {auth_header[:50] if auth_header != 'No Authorization header' else auth_header}...")
    print(f"{'='*60}\n")

@app.after_request
def log_response(response):
    if response.status_code >= 400:
        print(f"[ERROR] RESPONSE: {response.status_code}")
    return response

@app.route('/api/profiles', methods=['GET'])
def get_profiles():
    """Get all available profiles"""
    profiles = Profile.query.all()
    return jsonify({
        'profiles': [profile.to_dict() for profile in profiles],
        'total': len(profiles),
        'max_profiles': 3
    }), 200


@app.route('/api/profiles/create', methods=['POST'])
def create_profile():
    """Create a new profile (max 3 profiles)"""
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    # Validation
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400
    
    # Check if profile already exists
    if Profile.query.filter_by(username=username).first():
        return jsonify({'error': 'Profile already exists'}), 409
    
    # Check max profiles limit
    profile_count = Profile.query.count()
    if profile_count >= 3:
        return jsonify({'error': 'Maximum 3 profiles allowed. Delete a profile to create a new one.'}), 400
    
    # Create new profile
    new_profile = Profile(username=username)
    new_profile.set_password(password)
    
    try:
        db.session.add(new_profile)
        db.session.commit()
        
        # Create JWT token
        access_token = create_access_token(identity=str(new_profile.id))
        
        return jsonify({
            'message': 'Profile created successfully',
            'profile': new_profile.to_dict(),
            'access_token': access_token
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create profile'}), 500


@app.route('/api/profiles/login', methods=['POST'])
def login_profile():
    """Login to an existing profile"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    profile = Profile.query.filter_by(username=username).first()
    
    if not profile or not profile.verify_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401
    
    # Create JWT token
    access_token = create_access_token(identity=str(profile.id))
    
    return jsonify({
        'message': 'Login successful',
        'profile': profile.to_dict(),
        'access_token': access_token
    }), 200


@app.route('/api/profiles/<int:profile_id>', methods=['DELETE'])
def delete_profile(profile_id):
    """Delete a profile"""
    profile = Profile.query.get(profile_id)
    
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    
    try:
        db.session.delete(profile)
        db.session.commit()
        return jsonify({'message': 'Profile deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete profile'}), 500


@app.route('/api/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """Upload and process file for text extraction"""
    try:
        # Get JWT identity to verify token worked
        current_user = get_jwt_identity()
        print(f"[OK] JWT validated for user: {current_user}")
        
        # Validate file exists
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if not file or file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'pdf'}
        file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        
        if file_ext not in ALLOWED_EXTENSIONS:
            return jsonify({'error': f'Unsupported file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        
        # Validate file size (max 10MB)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File size exceeds 10MB limit'}), 400
        
        if file_size == 0:
            return jsonify({'error': 'File is empty'}), 400
        
        # Save file to uploads folder
        try:
            filename = secure_filename(file.filename)
            import time
            unique_filename = f"{int(time.time())}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # Create uploads directory if it doesn't exist
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            file.save(filepath)
            
            print(f"File saved to: {filepath}")
            print(f"File exists: {os.path.exists(filepath)}")
            print(f"File size: {os.path.getsize(filepath)}")
            
        except Exception as save_err:
            print(f"File save error: {save_err}")
            return jsonify({'error': f'Failed to save file: {str(save_err)}'}), 500
        
        # Process file with OCR
        try:
            extracted_text = process_file(filepath)
            print(f"Extracted text length: {len(extracted_text)}")
            
            # Check if OCR returned an error
            if 'Error' in extracted_text or 'Unsupported' in extracted_text:
                # Clean up the uploaded file before returning error
                if os.path.exists(filepath):
                    os.remove(filepath)
                return jsonify({'error': extracted_text}), 400
            
            # Clean up the uploaded file
            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"Cleaned up file: {filepath}")
            
            if not extracted_text or extracted_text.strip() == '':
                return jsonify({'error': 'No text found in file. Please check if the image contains readable text.'}), 400
            
            return jsonify({'text': extracted_text}), 200
            
        except Exception as ocr_err:
            print(f"OCR processing error: {ocr_err}")
            import traceback
            print(traceback.format_exc())
            
            # Clean up the uploaded file
            if os.path.exists(filepath):
                os.remove(filepath)
            
            return jsonify({'error': f'Failed to extract text: {str(ocr_err)}'}), 500
            
    except Exception as e:
        print(f"Upload endpoint error: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500


@app.route('/api/define', methods=['POST'])
def define_word():
    """Get definition for a word"""
    data = request.json
    word = data.get('word')
    if not word:
        return jsonify({'error': 'Word not provided'}), 400
    definition = get_word_definition(word)
    return jsonify({'definition': definition})


@app.route('/api/simplify', methods=['POST'])
def simplify_text():
    """Simplify text for easier reading"""
    data = request.json
    text = data.get('text')
    if not text:
        return jsonify({'error': 'Text not provided'}), 400
    simplified_text = simplify_paragraph(text)
    return jsonify({'simplified_text': simplified_text})


@app.route('/api/quiz', methods=['POST'])
def create_quiz():
    """Generate quiz from text"""
    data = request.json
    text = data.get('text')
    if not text:
        return jsonify({'error': 'Text not provided'}), 400
    
    quiz_data = generate_quiz(text)
    
    # If there's an error, return it
    if isinstance(quiz_data, dict) and 'error' in quiz_data:
        return jsonify(quiz_data), 400
    
    # Success case - return the quiz array
    if isinstance(quiz_data, list) and len(quiz_data) > 0:
        return jsonify(quiz_data), 200
    
    # Fallback error
    return jsonify({'error': 'Failed to generate valid quiz'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)