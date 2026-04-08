import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import os

def process_file(file_path):
    """
    Processes an uploaded file (image or PDF) and extracts text using OCR.
    Supports both Hindi and English.
    """
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        
        # Define the language parameter for bilingual support
        # 'hin+eng' allows simultaneous detection of both scripts
        ocr_lang = 'hin+eng'
        
        if file_extension in ['.png', '.jpg', '.jpeg', '.bmp', '.tiff']:
            # UPDATE: Added lang parameter
            return pytesseract.image_to_string(Image.open(file_path), lang=ocr_lang)
            
        elif file_extension == '.pdf':
            images = convert_from_path(file_path)
            full_text = ""
            for i, image in enumerate(images):
                page_image_path = f'temp_page_{i}.jpg'
                image.save(page_image_path, 'JPEG')
                # UPDATE: Added lang parameter here too
                full_text += pytesseract.image_to_string(Image.open(page_image_path), lang=ocr_lang) + "\n\n"
                os.remove(page_image_path)
            return full_text
            
        else:
            return "Unsupported file type."
            
    except Exception as e:
        print(f"Error processing file: {e}")
        return "Error occurred during file processing."