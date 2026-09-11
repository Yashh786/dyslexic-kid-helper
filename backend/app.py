from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError
import os
import secrets
from datetime import timedelta
from dotenv import load_dotenv

from db_models import db, Profile
from ocr_processor import process_file
from ai_services import get_word_definition, simplify_paragraph, generate_quiz

# Load environment variables from .env file
load_dotenv()

APP_ENV = os.getenv('APP_ENV', 'development').lower()
IS_PRODUCTION = APP_ENV == 'production'

app = Flask(__name__)

# Enable CORS with proper headers for JWT.
# ALLOWED_ORIGINS defaults to "*" (today's behavior). For a real deployment,
# set it to your actual frontend URL(s), comma-separated, e.g.:
#   ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com
_allowed_origins_env = os.getenv('ALLOWED_ORIGINS', '*')
if IS_PRODUCTION and _allowed_origins_env.strip() in ('', '*'):
    raise RuntimeError('ALLOWED_ORIGINS must be set to the frontend HTTPS origin in production')
allowed_origins = (
    '*' if _allowed_origins_env.strip() == '*'
    else [o.strip() for o in _allowed_origins_env.split(',') if o.strip()]
)
CORS(app, 
     resources={r"/api/*": {
         "origins": allowed_origins,
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
# IMPORTANT: Always set JWT_SECRET_KEY in your .env / environment for production.
# If it's missing, we generate a random one for this process instead of falling
# back to a hardcoded value (a shared hardcoded secret would let anyone forge
# valid tokens against any deployment of this codebase). Note that a generated
# key means existing tokens become invalid if the server restarts, so set the
# env var explicitly once you're running this for real.
jwt_secret = os.getenv('JWT_SECRET_KEY')
if not jwt_secret:
    if IS_PRODUCTION:
        raise RuntimeError('JWT_SECRET_KEY must be set in production')
    jwt_secret = secrets.token_hex(32)
    print("[WARN] JWT_SECRET_KEY not set in environment - generated a temporary "
          "random secret for this run. Set JWT_SECRET_KEY in your .env for a "
          "stable, production-ready deployment.")
app.config['JWT_SECRET_KEY'] = jwt_secret
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=8)
print(f"[OK] JWT Secret Key configured ({len(jwt_secret)} chars)")

if IS_PRODUCTION and not os.getenv('GROQ_API_KEY'):
    raise RuntimeError('GROQ_API_KEY must be set in production')

# Initialize database and JWT
db.init_app(app)
jwt = JWTManager(app)

# Rate limiting - protects password-guessing endpoints from brute force.
# Uses in-memory storage: fine for a single backend instance (this project's
# deployment target); if you ever run multiple backend replicas behind a
# load balancer, point storage_uri at shared Redis instead.
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],  # no global limit - only the routes below are limited
    storage_uri="memory://"
)

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

@app.route('/api/health', methods=['GET'])
def health_check():
    """Lightweight health-check endpoint for deployment platforms / load balancers."""
    return jsonify({'status': 'ok'}), 200

# Middleware to log all requests (method + path only - never log auth headers/tokens)
@app.before_request
def log_request():
    print(f"[REQUEST] {request.method} {request.path}")

@app.after_request
def log_response(response):
    if response.status_code >= 400:
        print(f"[ERROR] RESPONSE: {request.method} {request.path} -> {response.status_code}")
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
@limiter.limit("10 per minute")
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
@limiter.limit("10 per minute")
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
@jwt_required()
def delete_profile(profile_id):
    """Delete a profile. Requires a valid JWT for that exact profile
    (the frontend obtains this by re-verifying the password first)."""
    current_user = get_jwt_identity()
    if current_user != str(profile_id):
        return jsonify({'error': 'You can only delete your own profile'}), 403

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
@limiter.limit("20 per hour")
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
            unique_filename = f"{secrets.token_hex(16)}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # Create uploads directory if it doesn't exist
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            file.save(filepath)
            
            print(f"File saved to: {filepath}")
            print(f"File exists: {os.path.exists(filepath)}")
            print(f"File size: {os.path.getsize(filepath)}")

            # Verify the file contents, not just the filename extension.
            if file_ext == 'pdf':
                with open(filepath, 'rb') as uploaded_file:
                    valid_pdf = uploaded_file.read(5) == b'%PDF-'
                if not valid_pdf:
                    os.remove(filepath)
                    return jsonify({'error': 'The uploaded file is not a valid PDF.'}), 400
            else:
                try:
                    with Image.open(filepath) as uploaded_image:
                        uploaded_image.verify()
                except (UnidentifiedImageError, OSError):
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    return jsonify({'error': 'The uploaded file is not a valid image.'}), 400
            
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
@jwt_required()
@limiter.limit("100 per hour")
def define_word():
    """Get definition for a word"""
    data = request.json
    word = data.get('word')
    if not word:
        return jsonify({'error': 'Word not provided'}), 400
    definition = get_word_definition(word)
    return jsonify({'definition': definition})


@app.route('/api/simplify', methods=['POST'])
@jwt_required()
@limiter.limit("60 per hour")
def simplify_text():
    """Simplify text for easier reading"""
    data = request.json
    text = data.get('text')
    if not text:
        return jsonify({'error': 'Text not provided'}), 400
    simplified_text = simplify_paragraph(text)
    return jsonify({'simplified_text': simplified_text})


@app.route('/api/quiz', methods=['POST'])
@jwt_required()
@limiter.limit("30 per hour")
def create_quiz():
    """Generate quiz from text"""
    data = request.json
    text = data.get('text')
    if not text:
        return jsonify({'error': 'Text not provided'}), 400
    
    # Check if text is in Hindi
    from ai_services import is_hindi_text
    if is_hindi_text(text):
        return jsonify({'error': 'Quiz for Hindi text is not available for now. Please upload text in English.'}), 400
    
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
    # Debug mode is OFF by default - it must be explicitly opted into for local
    # development only (FLASK_DEBUG=true in your .env). Never enable it in
    # production: Flask's debugger can allow remote code execution if exposed.
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode, use_reloader=False)