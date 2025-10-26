import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import os

# NOTE: You must have Tesseract and poppler installed on your system or in the Docker container.
# The backend Dockerfile handles this installation.

def process_file(file_path):
    """
    Processes an uploaded file (image or PDF) and extracts text using OCR.
    """
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        
        if file_extension in ['.png', '.jpg', '.jpeg', '.bmp', '.tiff']:
            return pytesseract.image_to_string(Image.open(file_path))
            
        elif file_extension == '.pdf':
            # Convert PDF to a list of images
            images = convert_from_path(file_path)
            full_text = ""
            # Process each page
            for i, image in enumerate(images):
                # Save each page as a temporary image to be processed by tesseract
                page_image_path = f'temp_page_{i}.jpg'
                image.save(page_image_path, 'JPEG')
                full_text += pytesseract.image_to_string(Image.open(page_image_path)) + "\n\n"
                os.remove(page_image_path) # Clean up temporary image
            return full_text
            
        else:
            return "Unsupported file type."
            
    except Exception as e:
        print(f"Error processing file: {e}")
        return "Error occurred during file processing."