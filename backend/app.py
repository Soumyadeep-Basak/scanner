import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth
from datetime import datetime

# load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Load Firebase Admin SDK credentials
cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'firebase_config.json'))
firebase_admin.initialize_app(cred)

# Define Uploads Folder
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Create main folder
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Function to verify Firebase Token
def verify_firebase_token(token):
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        return None

# Helper function to generate a timestamped filename
def generate_timestamped_filename(original_filename):
    # Extract file extension
    file_extension = os.path.splitext(original_filename)[1]
    # Generate timestamp (format: YYYYMMDD_HHMMSS)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # Combine timestamp with original filename (without extension) and extension
    return f"{os.path.splitext(original_filename)[0]}_{timestamp}{file_extension}"

# 🔹 File Upload Route (Protected)
@app.route('/upload', methods=['POST'])
def upload():
    token = request.headers.get("Authorization")

    if not token:
        return jsonify({"error": "Unauthorized"}), 401

    decoded_token = verify_firebase_token(token)
    if not decoded_token:
        return jsonify({"error": "Invalid Token"}), 401

    user_email = decoded_token.get("email")
    if not user_email:
        return jsonify({"error": "Invalid User"}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    
    # Generate a timestamped filename
    timestamped_filename = generate_timestamped_filename(file.filename)
    
    # User-Specific Directory
    user_folder = os.path.join(app.config["UPLOAD_FOLDER"], user_email)
    os.makedirs(user_folder, exist_ok=True)

    # Save the file in user's folder with the timestamped filename
    file_path = os.path.join(user_folder, timestamped_filename)
    file.save(file_path)

    return jsonify({
        "message": "File uploaded successfully!",
        "filename": timestamped_filename,
        "user": user_email
    })

# 🔹 Fetch User's Uploaded Files
@app.route('/my-uploads', methods=['GET'])
def my_uploads():
    token = request.headers.get("Authorization")

    if not token:
        return jsonify({"error": "Unauthorized"}), 401

    decoded_token = verify_firebase_token(token)
    if not decoded_token:
        return jsonify({"error": "Invalid Token"}), 401

    user_email = decoded_token.get("email")
    user_folder = os.path.join(app.config["UPLOAD_FOLDER"], user_email)

    if not os.path.exists(user_folder):
        return jsonify([])

    files = os.listdir(user_folder)
    return jsonify(files)

# 🔹 Serve Uploaded Files
@app.route('/uploads/<path:filename>', methods=['GET'])
def uploaded_file(filename):
    user_email = request.args.get("user")
    if not user_email:
        return jsonify({"error": "User email is required"}), 400

    user_folder = os.path.join(app.config["UPLOAD_FOLDER"], user_email)

    if not os.path.exists(user_folder):
        return jsonify({"error": "User folder not found"}), 404

    return send_from_directory(user_folder, filename)

# 🔹 Health Check Route
@app.route('/')
def home():
    return jsonify({"message": "Backend is running!"})

if __name__ == '__main__':
    app.run(debug=True)