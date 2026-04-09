import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import os

def process_file(file_path):
    """
    Processes an uploaded file (image or PDF) and extracts text using OCR.
    Supports both Hindi and English.
    """
    print(f"Starting OCR processing for: {file_path}")
    
    try:
        # Check file exists
        if not os.path.exists(file_path):
            return f"Error: File not found at {file_path}"
        
        file_size = os.path.getsize(file_path)
        print(f"File size: {file_size} bytes")
        
        file_extension = os.path.splitext(file_path)[1].lower()
        print(f"File extension: {file_extension}")
        
        # Define the language parameter for bilingual support
        ocr_lang = 'hin+eng'
        
        if file_extension in ['.png', '.jpg', '.jpeg', '.bmp', '.tiff']:
            try:
                print(f"Processing image file: {file_extension}")
                img = Image.open(file_path)
                print(f"Image mode: {img.mode}, Size: {img.size}")
                
                # Convert RGBA or other modes to RGB if needed
                if img.mode in ('RGBA', 'LA', 'P'):
                    print(f"Converting image from {img.mode} to RGB")
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    text = pytesseract.image_to_string(rgb_img, lang=ocr_lang)
                else:
                    text = pytesseract.image_to_string(img, lang=ocr_lang)
                
                print(f"OCR extracted {len(text)} characters")
                
                if not text or text.strip() == '':
                    return "No text found in image. Please check if the image contains readable text."
                return text
                
            except pytesseract.TesseractNotFoundError as e:
                return "Error: Tesseract OCR is not installed. Please install Tesseract-OCR."
            except FileNotFoundError as e:
                return f"Error: Could not open image file. {str(e)}"
            except Exception as e:
                print(f"Image processing error: {e}")
                import traceback
                print(traceback.format_exc())
                return f"Error processing image: {str(e)}"
            
        elif file_extension == '.pdf':
            try:
                print("Processing PDF file")
                images = convert_from_path(file_path)
                print(f"Converted PDF to {len(images)} images")
                
                if not images:
                    return "Error: Could not convert PDF to images."
                
                full_text = ""
                for i, image in enumerate(images):
                    page_image_path = f'temp_page_{i}.jpg'
                    try:
                        image.save(page_image_path, 'JPEG')
                        img = Image.open(page_image_path)
                        text = pytesseract.image_to_string(img, lang=ocr_lang)
                        full_text += text + "\n\n"
                        print(f"Processed page {i}: {len(text)} characters")
                    except Exception as page_err:
                        print(f"Error processing page {i}: {page_err}")
                    finally:
                        if os.path.exists(page_image_path):
                            os.remove(page_image_path)
                
                print(f"Total extracted from PDF: {len(full_text)} characters")
                
                if not full_text or full_text.strip() == '':
                    return "No text found in PDF. Please check if the PDF contains readable text."
                return full_text
                
            except pytesseract.TesseractNotFoundError:
                return "Error: Tesseract OCR is not installed. Please install Tesseract-OCR."
            except ImportError as e:
                return f"Error: Required library not installed. {str(e)}"
            except Exception as e:
                print(f"PDF processing error: {e}")
                import traceback
                print(traceback.format_exc())
                return f"Error processing PDF: {str(e)}"
            
        else:
            return f"Unsupported file type: {file_extension}. Please upload an image (PNG, JPG, BMP, TIFF) or PDF."
            
    except Exception as e:
        print(f"Error in process_file: {e}")
        import traceback
        print(traceback.format_exc())
        return f"Unexpected error: {str(e)}"