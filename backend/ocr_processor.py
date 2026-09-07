import pytesseract
from PIL import Image, ImageFilter, ImageEnhance
from pdf2image import convert_from_path
import os
import re
import shutil


def _configure_tesseract():
    """Configure the Tesseract executable for local and container runs."""
    configured_path = os.getenv('TESSERACT_CMD')
    candidates = [configured_path] if configured_path else []
    candidates.extend([
        shutil.which('tesseract'),
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
        '/usr/bin/tesseract',
    ])

    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            print(f"[OK] Tesseract executable: {candidate}")
            return candidate

    print('[WARN] Tesseract executable was not found. Set TESSERACT_CMD to its full path.')
    return None


_configure_tesseract()


def preprocess_image(img):
    """
    Preprocess image for better OCR accuracy.
    """
    # Convert to RGB first if needed
    if img.mode in ('RGBA', 'LA', 'P'):
        rgb_img = Image.new('RGB', img.size, (255, 255, 255))
        rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = rgb_img
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Convert to grayscale
    img = img.convert('L')

    # Upscale small images
    width, height = img.size
    if width < 1500:
        scale_factor = 2
        img = img.resize((width * scale_factor, height * scale_factor), Image.LANCZOS)
        print(f"  Upscaled from {width}x{height} to {img.size[0]}x{img.size[1]}")

    # Sharpen
    img = img.filter(ImageFilter.SHARPEN)

    # Enhance contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)

    # Binarize
    threshold = 140
    img = img.point(lambda x: 255 if x > threshold else 0, '1')
    img = img.convert('L')

    return img


def _is_devanagari_letter(c):
    """Check if char is a Devanagari letter (NOT a digit)."""
    # Devanagari block: U+0900-U+097F
    # Devanagari digits: U+0966-U+096F
    # Purna viram: U+0964, double danda: U+0965
    cp = ord(c)
    return 0x0900 <= cp <= 0x097F and not (0x0966 <= cp <= 0x096F)


def _is_devanagari_digit(c):
    """Check if char is a Devanagari digit (०-९)."""
    return '\u0966' <= c <= '\u096F'


def _count_dev_letters(text):
    """Count Devanagari letters (excluding digits) in text."""
    return sum(1 for c in text if _is_devanagari_letter(c))


def _count_eng_alpha(text):
    """Count English alphabetic characters."""
    return sum(1 for c in text if c.isascii() and c.isalpha())


def detect_language(img):
    """
    Auto-detect language by comparing Devanagari vs English character counts.
    """
    try:
        hindi_text = pytesseract.image_to_string(img, lang='hin', config='--psm 6 --oem 3')
        dev_count = _count_dev_letters(hindi_text)

        eng_text = pytesseract.image_to_string(img, lang='eng', config='--psm 6 --oem 3')
        eng_count = _count_eng_alpha(eng_text)

        total = dev_count + eng_count
        print(f"  Lang detection: Devanagari={dev_count}, English={eng_count}")

        if total == 0:
            return 'eng'

        dev_ratio = dev_count / total
        if dev_ratio > 0.5:
            print(f"  Language: Hindi (ratio={dev_ratio:.2f})")
            return 'hin'
        elif dev_ratio > 0.15:
            print(f"  Language: Hindi+English (ratio={dev_ratio:.2f})")
            return 'hin+eng'
        else:
            print(f"  Language: English (ratio={dev_ratio:.2f})")
            return 'eng'
    except Exception as e:
        print(f"  Language detection failed ({e}), defaulting to eng")
        return 'eng'


def run_ocr(img, lang):
    """Run Tesseract OCR with optimal config."""
    return pytesseract.image_to_string(img, lang=lang, config='--oem 3 --psm 6')


def _clean_hindi_line(line):
    """
    Clean a Hindi line:
    1. Truncate at first purna viram (।) if present — removes illustration garbage on the right
    2. Remove Devanagari digits, English chars, and all symbols
    3. Keep only Devanagari letters, spaces, hyphens, commas
    """
    # Step 1: Truncate at first purna viram (।)
    viram_pos = line.find('।')
    if viram_pos != -1:
        line = line[:viram_pos + 1]  # Keep up to and including the viram

    # Step 2: Keep only Devanagari letters + spaces + hyphens + commas + purna viram
    result = []
    for c in line:
        if _is_devanagari_letter(c):
            result.append(c)
        elif c in ' -,':
            result.append(c)
        # Everything else is stripped: English letters, digits, symbols, Devanagari digits

    cleaned = ''.join(result).strip()
    cleaned = re.sub(r' +', ' ', cleaned)  # Collapse spaces
    cleaned = cleaned.strip(' -,')  # Remove leading/trailing punct
    return cleaned


def _is_valid_hindi_line(cleaned_line):
    """
    Check if a cleaned Hindi line contains real text (not OCR garbage).
    
    Real Hindi text has mostly substantial words (3+ Devanagari chars).
    Garbage from illustrations has mostly single-char or 2-char fragments.
    
    Rules:
    - Must have at least 6 Devanagari letters total
    - Must have at least 2 "substantial words" (3+ Devanagari chars each)
    - At least 40% of words must be substantial
    """
    if not cleaned_line:
        return False

    total_dev = _count_dev_letters(cleaned_line)
    if total_dev < 6:
        return False

    # Split into words and analyze
    words = cleaned_line.split()
    if not words:
        return False

    dev_words = []  # Words that contain Devanagari
    for w in words:
        dev_in_word = _count_dev_letters(w)
        if dev_in_word > 0:
            dev_words.append(dev_in_word)

    if not dev_words:
        return False

    substantial_count = sum(1 for d in dev_words if d >= 3)
    total_word_count = len(dev_words)

    # Must have at least 2 substantial words
    if substantial_count < 2:
        return False

    # At least 40% of words should be substantial
    ratio = substantial_count / total_word_count
    if ratio < 0.4:
        return False

    return True


def clean_ocr_text(text, lang):
    """
    Post-process OCR output: remove garbage lines and clean text.
    """
    if not text:
        return text

    # Remove control characters
    cleaned = ''.join(c for c in text if c == '\n' or c == '\r' or c == '\t' or (ord(c) >= 32))

    lines = cleaned.split('\n')
    result_lines = []

    for line in lines:
        stripped = ' '.join(line.split()).strip()

        if not stripped:
            if result_lines and result_lines[-1] != '':
                result_lines.append('')
            continue

        # === HINDI MODE ===
        if lang == 'hin':
            cleaned_line = _clean_hindi_line(stripped)

            if not cleaned_line:
                print(f"  [REMOVED] Empty after clean: '{stripped}'")
                continue

            if _is_valid_hindi_line(cleaned_line):
                result_lines.append(cleaned_line)
            else:
                print(f"  [REMOVED] Failed quality check: '{stripped}' → '{cleaned_line}'")

        # === ENGLISH MODE ===
        elif lang == 'eng':
            # Remove Devanagari chars
            stripped = ''.join(c for c in stripped if not ('\u0900' <= c <= '\u097F'))
            stripped = ' '.join(stripped.split()).strip()

            if not stripped:
                continue

            eng_count = _count_eng_alpha(stripped)
            non_space = sum(1 for c in stripped if not c.isspace())
            if non_space > 0 and eng_count / non_space < 0.3:
                print(f"  [REMOVED] Low English ratio: '{stripped}'")
                continue

            result_lines.append(stripped)

        # === BILINGUAL MODE ===
        elif lang == 'hin+eng':
            dev_count = _count_dev_letters(stripped)
            eng_count = _count_eng_alpha(stripped)
            letter_count = dev_count + eng_count
            non_space = sum(1 for c in stripped if not c.isspace())

            if non_space > 0 and letter_count / non_space < 0.3:
                print(f"  [REMOVED] Low letter ratio: '{stripped}'")
                continue
            if letter_count < 3:
                print(f"  [REMOVED] Too few letters: '{stripped}'")
                continue
            result_lines.append(stripped)

    # Remove trailing empty lines
    while result_lines and result_lines[-1] == '':
        result_lines.pop()

    return '\n'.join(result_lines).strip()


def process_file(file_path):
    """
    Processes an uploaded file (image or PDF) and extracts text using OCR.
    Supports both Hindi and English with auto-detection.
    """
    print(f"Starting OCR processing for: {file_path}")

    try:
        if not os.path.exists(file_path):
            return f"Error: File not found at {file_path}"

        file_size = os.path.getsize(file_path)
        print(f"File size: {file_size} bytes")

        file_extension = os.path.splitext(file_path)[1].lower()
        print(f"File extension: {file_extension}")

        if file_extension in ['.png', '.jpg', '.jpeg', '.bmp', '.tiff']:
            try:
                print(f"Processing image file: {file_extension}")
                img = Image.open(file_path)
                print(f"Image mode: {img.mode}, Size: {img.size}")

                print("  Preprocessing image...")
                processed_img = preprocess_image(img)

                print("  Detecting language...")
                ocr_lang = detect_language(processed_img)

                print(f"  Running OCR with lang={ocr_lang}...")
                text = run_ocr(processed_img, ocr_lang)

                text = clean_ocr_text(text, ocr_lang)

                print(f"OCR extracted {len(text)} characters")

                if not text or text.strip() == '':
                    return "No text found in image. Please check if the image contains readable text."
                return text

            except pytesseract.TesseractNotFoundError:
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

                first_page_processed = preprocess_image(images[0])
                ocr_lang = detect_language(first_page_processed)
                print(f"  Detected language for PDF: {ocr_lang}")

                full_text = ""
                for i, image in enumerate(images):
                    try:
                        processed_page = preprocess_image(image)
                        text = run_ocr(processed_page, ocr_lang)
                        text = clean_ocr_text(text, ocr_lang)
                        full_text += text + "\n\n"
                        print(f"Processed page {i}: {len(text)} characters")
                    except Exception as page_err:
                        print(f"Error processing page {i}: {page_err}")

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