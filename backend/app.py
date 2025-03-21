import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth
from datetime import datetime
import img2pdf
from PIL import Image
import mimetypes
from dotenv import load_dotenv
import dropbox  # Import Dropbox SDK

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)

# Load Firebase Admin SDK credentials
cred_path = os.path.join(os.path.dirname(__file__), 'firebase_config.json')
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)

# Dropbox Access Token
DROPBOX_ACCESS_TOKEN = os.getenv("DROPBOX_ACCESS_TOKEN")
dbx = dropbox.Dropbox(DROPBOX_ACCESS_TOKEN)  # Initialize Dropbox client

# Define Uploads Folder
UPLOAD_FOLDER = os.path.join(os.getcwd(), "backend", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# ✅ Function to verify Firebase Token
def verify_firebase_token(token):
    try:
        return auth.verify_id_token(token)
    except Exception as e:
        print(f"[ERROR] Token verification failed: {str(e)}")
        return None

# ✅ Helper function: Generate timestamped filename
def generate_timestamped_filename(original_filename, extension=None):
    file_extension = extension or os.path.splitext(original_filename)[1]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{os.path.splitext(original_filename)[0]}_{timestamp}{file_extension}"

# ✅ Function to convert image to PDF
def convert_image_to_pdf(image_path, pdf_path):
    try:
        if not os.path.exists(image_path):
            return False, "Image file does not exist"
        
        with Image.open(image_path) as img:
            img.verify()  # Validate the image
        with open(pdf_path, "wb") as pdf_file:
            pdf_file.write(img2pdf.convert(image_path))
        
        return True, "Conversion successful"
    except Exception as e:
        print(f"[ERROR] PDF conversion failed: {str(e)}")
        return False, str(e)

# 🔹 Upload File Route
@app.route('/upload', methods=['POST'])
def upload():
    try:
        # 🔹 Step 1: Authenticate the User
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return jsonify({"error": "Invalid Token"}), 401

        user_email = decoded_token.get("email")
        if not user_email:
            return jsonify({"error": "Invalid User"}), 401

        # 🔹 Step 2: Validate File Input
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "Empty filename"}), 400

        # 🔹 Step 3: Ensure Upload Directory Exists
        os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

        # 🔹 Step 4: Generate a Timestamped Filename with User Email
        filename = generate_timestamped_filename(file.filename)
        filename = f"{user_email}_{filename}"  # Add user email to filename
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

        print(f"[DEBUG] Saving file to: {file_path}")  # Debugging

        # 🔹 Step 5: Save File Locally
        try:
            file.save(file_path)
        except Exception as e:
            return jsonify({"error": f"Failed to save file locally: {str(e)}"}), 500

        if not os.path.exists(file_path):
            return jsonify({"error": "File save failed"}), 500

        print("[DEBUG] File saved successfully, uploading to Dropbox...")  # Debugging

        # 🔹 Step 6: Upload File to Dropbox
        try:
            with open(file_path, "rb") as f:
                dbx.files_upload(f.read(), f"/{filename}")  # Upload to Dropbox
            file_link = dbx.sharing_create_shared_link(f"/{filename}").url  # Generate shareable link
            print(f"[DEBUG] Upload successful: {file_link}")  # Debugging
        except Exception as e:
            return jsonify({"error": f"Dropbox upload failed: {str(e)}"}), 500

        # 🔹 Step 7: Cleanup Local File
        try:
            os.remove(file_path)
            print("[DEBUG] Local file deleted successfully.")  # Debugging
        except Exception as e:
            print(f"[WARNING] Failed to delete local file: {str(e)}")  # Not critical

        # 🔹 Step 8: Return Success Response
        return jsonify({
            "message": "File uploaded successfully!",
            "filename": filename,
            "url": file_link
        })

    except Exception as e:
        print(f"[ERROR] Upload function failed: {str(e)}")
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500

# 🔹 Fetch User's Uploaded Files
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
    if not user_email:
        return jsonify({"error": "Invalid User"}), 401

    try:
        # Fetch all files from Dropbox
        files = dbx.files_list_folder("").entries  # List files in the root folder
        file_list = []
        for file in files:
            if isinstance(file, dropbox.files.FileMetadata):
                if user_email in file.name:  # Filter files specific to the user
                    # Strip the email prefix from the filename
                    filename_without_email = file.name.split(user_email + "_", 1)[-1]
                    file_link = dbx.sharing_create_shared_link(file.path_display).url  # Generate shareable link
                    file_list.append({
                        "name": filename_without_email,  # Use the filename without the email prefix
                        "url": file_link
                    })

        print("[DEBUG] Filtered File List:", file_list)  # Debugging output
        return jsonify(file_list)

    except Exception as e:
        print(f"[ERROR] Fetching files failed: {str(e)}")
        return jsonify({"error": f"Failed to fetch files: {str(e)}"}), 500

# 🔹 Serve Uploaded Files
@app.route('/uploads/<filename>', methods=['GET'])
def uploaded_file(filename):
    user_email = request.args.get("user")
    if not user_email:
        return jsonify({"error": "User email is required"}), 400

    user_folder = os.path.join(app.config["UPLOAD_FOLDER"], user_email)
    if not os.path.exists(user_folder):
        return jsonify({"error": "User folder not found"}), 404

    file_path = os.path.join(user_folder, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    content_type, _ = mimetypes.guess_type(file_path)
    return send_from_directory(user_folder, filename, mimetype=content_type)

# 🔹 Health Check Route
@app.route('/')
def home():
    return jsonify({"message": "Backend is running!"})

if __name__ == '__main__':
    app.run(debug=True)