import { auth } from './auth.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// 🔹 Sign Up Function
window.signUp = function() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      console.log("Sign Up Successful!");
      window.location.href = "dashboard.html"; // Redirect to Dashboard
    })
    .catch(error => {
      console.error("Sign Up Error:", error.message);
    });
}

// 🔹 Login Function
window.login = function() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      console.log("Login Successful!");
      window.location.href = "dashboard.html"; // Redirect to Dashboard
    })
    .catch(error => {
      console.error("Login Error:", error.message);
    });
}

// 🔹 Protect Dashboard Page
onAuthStateChanged(auth, (user) => {
  const pathname = window.location.pathname;
  
  if (!user && (pathname.includes('/dashboard.html') || pathname.includes('/camera.html'))) {
    window.location.href = "index.html"; // Redirect to Login Page if not authenticated
  } else if (user && pathname.includes('/dashboard.html')) {
    // If user is logged in, show uploaded files
    showUploadedFiles();
  }
});

// 🔹 Logout Function
window.logout = function() {
  signOut(auth)
    .then(() => {
      console.log("Logged Out!");
      window.location.href = "index.html"; // Redirect to Login Page
    })
    .catch(error => {
      console.error("Logout Error:", error.message);
    });
}

// 🟢 Upload File
window.uploadFile = async function() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  
  if (!file) {
    console.error("No file selected.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.error("User not authenticated.");
    return;
  }

  // Show loading state
  const uploadButton = document.querySelector('#uploadBtn');
  if (uploadButton) {
    uploadButton.textContent = "Uploading...";
    uploadButton.disabled = true;
  }

  const token = await user.getIdToken();
  
  const formData = new FormData();
  formData.append("file", file);

  try {
    console.log(`Uploading file: ${file.name}, type: ${file.type}, size: ${file.size}`);
    
    const response = await fetch("http://127.0.0.1:5000/upload", {
      method: "POST",
      headers: {
        "Authorization": token
      },
      body: formData
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      // Handle server errors
      throw new Error(responseData.error || `Server responded with status: ${response.status}`);
    }
    
    // Success: File uploaded
    console.log("File uploaded successfully:", responseData.message);
    
    // Wait for 3 seconds before fetching the file list
    setTimeout(() => {
      showUploadedFiles();
    }, 3000); // 3-second delay
    
    // Reset the file input and selection display
    fileInput.value = '';
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      const defaultText = uploadArea.querySelector('p:not(.selected-file)');
      if (defaultText) {
        defaultText.style.display = 'block';
      }
      const existingSelection = uploadArea.querySelector('.selected-file');
      if (existingSelection) {
        uploadArea.removeChild(existingSelection);
      }
    }
  } catch (error) {
    console.error("Error uploading file:", error);
  } finally {
    // Reset button state
    if (uploadButton) {
      uploadButton.textContent = "Upload";
      uploadButton.disabled = false;
    }
  }
}

// 🟡 Show User's Uploaded Files
window.showUploadedFiles = async function() {
  const user = auth.currentUser;
  if (!user) return;

  const token = await user.getIdToken();

  try {
    const response = await fetch("http://127.0.0.1:5000/my-uploads", {
      method: "GET",
      headers: {
        "Authorization": token
      }
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const files = await response.json();
    console.log("Files fetched:", files);  // Debugging output

    const fileListElement = document.getElementById('fileList');
    if (!fileListElement) return;

    fileListElement.innerHTML = ''; // Clear previous entries

    if (files.length === 0) {
      const li = document.createElement('li');
      li.className = 'file-item file-empty';
      li.textContent = 'No files uploaded yet';
      fileListElement.appendChild(li);
    } else {
      files.forEach(file => {
        const li = document.createElement('li');
        li.className = 'file-item';
        
        li.innerHTML = `
          <a href="${file.url}" target="_blank">
            <i class="fas fa-file"></i> ${file.name}
          </a>`;
        fileListElement.appendChild(li);
      });
    }
  } catch (error) {
    console.error("Error fetching uploaded files:", error);
  }
};

// 📸 Redirect to Camera Page
window.redirectToCamera = function() {
  window.location.href = "camera.html";
}

// 🔙 Go Back to Dashboard
window.goBackToDashboard = function() {
  // Stop camera stream before navigating away
  const video = document.getElementById('cameraPreview');
  if (video && video.srcObject) {
    const stream = video.srcObject;
    stream.getTracks().forEach(track => track.stop());
  }
  
  window.location.href = "dashboard.html";
}

// Generate timestamp for filenames (format: YYYY-MM-DD_HH-MM-SS)
function generateTimestamp() {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// 📸 Initialize Camera
window.initCamera = function() {
  const video = document.getElementById('cameraPreview');
  if (!video) return;
  
  // Request camera access with preferred settings
  const constraints = {
    video: {
      facingMode: 'environment', // Prefer back camera if available
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
  
  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      video.srcObject = stream;
      video.play().catch(err => console.error("Error playing video:", err));
    })
    .catch(error => {
      console.error("Error accessing camera:", error);
    });
    
  // Set up capture button event listener
  const captureBtn = document.getElementById('captureBtn');
  if (captureBtn) {
    captureBtn.addEventListener('click', captureImage);
  }
}

// 📸 Capture Image and Convert to PDF
window.captureImage = function() {
  const video = document.getElementById('cameraPreview');
  const canvas = document.getElementById('canvas');
  const capturedImageContainer = document.getElementById('capturedImageContainer');
  const capturedImage = document.getElementById('capturedImage');
  const captureBtn = document.getElementById('captureBtn');
  const captureActions = document.getElementById('captureActions');
  
  if (!video || !canvas) {
    console.error("Video or canvas element not found");
    return;
  }
  
  const context = canvas.getContext('2d');
  
  // Set canvas size to match video dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Draw the video frame to the canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Display captured image in preview (still as image for preview only)
  capturedImage.src = canvas.toDataURL('image/png');
  
  // Update UI
  video.style.display = 'none';
  capturedImageContainer.style.display = 'block';
  captureBtn.style.display = 'none';
  captureActions.style.display = 'flex';
  
  // Generate a timestamp for the filename
  const timestamp = generateTimestamp();
  const filename = `captured_document_${timestamp}.pdf`; // PDF filename
  
  try {
    // Convert canvas to blob first
    canvas.toBlob(function(blob) {
      console.log("Canvas converted to blob:", blob.type, "size:", blob.size);
      
      // Store the image blob with filename (we'll convert to PDF on the server side)
      window.capturedImageBlob = new File([blob], filename.replace('.pdf', '.png'), { type: 'image/png' });
      window.capturedImageFilename = filename.replace('.pdf', '.png');
      
      console.log("Image prepared for upload:", window.capturedImageFilename);
    }, 'image/png', 0.95);
  } catch (error) {
    console.error("Error preparing image:", error);
  }
}

// 📤 Upload Captured Photo (let server convert to PDF)
window.uploadCapturedPhoto = async function() {
  if (!window.capturedImageBlob) {
    console.error("No document captured.");
    return;
  }
  
  const user = auth.currentUser;
  if (!user) {
    console.error("User not authenticated.");
    return;
  }
  
  try {
    const token = await user.getIdToken();
    
    // Use the stored image blob - server will convert to PDF
    const file = window.capturedImageBlob;
    
    // Show loading state
    const uploadBtn = document.querySelector('#captureActions .btn-primary');
    if (uploadBtn) {
      const originalText = uploadBtn.innerHTML;
      uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
      uploadBtn.disabled = true;
    }
    
    const formData = new FormData();
    formData.append("file", file);
    
    console.log("Uploading image:", file.name, "Size:", file.size, "Type:", file.type);
    
    const response = await fetch("http://127.0.0.1:5000/upload", {
      method: "POST",
      headers: {
        "Authorization": token
      },
      body: formData
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.error || `Server responded with status: ${response.status}`);
    }
    
    console.log("Upload response:", responseData);
    
    // Stop camera stream before navigating away
    const video = document.getElementById('cameraPreview');
    if (video && video.srcObject) {
      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Redirect back to dashboard
    window.location.href = "dashboard.html";
    
  } catch (error) {
    console.error("Error uploading captured document:", error);
  } finally {
    // Reset button if still on page
    const uploadBtn = document.querySelector('#captureActions .btn-primary');
    if (uploadBtn) {
      uploadBtn.innerHTML = '<i class="fas fa-check"></i> Use Document';
      uploadBtn.disabled = false;
    }
  }
}

// 🔄 Retake Photo
window.retakePhoto = function() {
  const video = document.getElementById('cameraPreview');
  const capturedImageContainer = document.getElementById('capturedImageContainer');
  const captureBtn = document.getElementById('captureBtn');
  const captureActions = document.getElementById('captureActions');
  
  // Update UI
  video.style.display = 'block';
  capturedImageContainer.style.display = 'none';
  captureBtn.style.display = 'block';
  captureActions.style.display = 'none';
  
  // Clear the captured image
  window.capturedImageBlob = null;
  window.capturedImageFilename = null;
}

// Event listeners section
document.addEventListener('DOMContentLoaded', function() {
  const pathname = window.location.pathname;
  
  // Camera page initialization
  if (pathname.includes('/camera.html')) {
    console.log("Initializing camera page");
    window.initCamera();
  }
  
  // Dashboard page initialization
  if (pathname.includes('/dashboard.html')) {
    console.log("Initializing dashboard page");
    
    // Add drag and drop functionality for file upload
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadArea && fileInput) {
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });
      
      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
      });
      
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          const fileName = e.dataTransfer.files[0].name;
          updateFileSelection(fileName);
        }
      });
      
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
          const fileName = fileInput.files[0].name;
          updateFileSelection(fileName);
        }
      });
    }
  }
});

// Helper function to update file selection display
function updateFileSelection(fileName) {
  const uploadArea = document.getElementById('uploadArea');
  if (!uploadArea) return;
  
  const fileNameDisplay = document.createElement('p');
  fileNameDisplay.classList.add('selected-file');
  fileNameDisplay.innerHTML = `<i class="fas fa-file-alt"></i> ${fileName}`;
  
  // Remove any existing file selection display
  const existingSelection = uploadArea.querySelector('.selected-file');
  if (existingSelection) {
    uploadArea.removeChild(existingSelection);
  }
  
  // Replace the default upload text
  const defaultText = uploadArea.querySelector('p:not(.selected-file)');
  if (defaultText) {
    defaultText.style.display = 'none';
  }
  
  uploadArea.appendChild(fileNameDisplay);
}