import requests
import os
import json
import random

OLLAMA_URL = "http://host.docker.internal:11434/api/generate"
MODEL_NAME = "mistral"

def randomize_quiz_options(quiz_questions):
    """
    Randomize the order of options in quiz questions to vary answer positions.
    This prevents the correct answer from always being in the same place.
    """
    if not quiz_questions or not isinstance(quiz_questions, list):
        return quiz_questions
    
    randomized = []
    for q in quiz_questions:
        if not isinstance(q, dict) or 'options' not in q or 'answer' not in q:
            randomized.append(q)
            continue
        
        options = q.get('options', [])
        if not isinstance(options, list) or len(options) < 2:
            randomized.append(q)
            continue
        
        # Shuffle the options
        shuffled_options = options.copy()
        random.shuffle(shuffled_options)
        
        # Create new question with shuffled options
        randomized_q = q.copy()
        randomized_q['options'] = shuffled_options
        randomized.append(randomized_q)
    
    return randomized

def call_ollama(prompt, is_json=False):
    # ... (This function remains unchanged)
    payload = {"model": MODEL_NAME, "prompt": prompt, "stream": False}
    if is_json:
        payload["format"] = "json"
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=60)
        response.raise_for_status()
        response_data = response.json()
        return response_data.get('response', '')
    except requests.exceptions.RequestException as e:
        print(f"Ollama API request failed: {e}")
        return json.dumps({"error": "Could not connect to the local AI model. Is Ollama running?"})

def get_word_definition(word):
    # ... (This function remains unchanged)
    prompt = f"Provide a very simple, one-sentence or much shorter definition for a 10-year-old child for the word: '{word}'."
    response_text = call_ollama(prompt)
    return response_text.strip()

def simplify_paragraph(text):
    # ... (This function remains unchanged)
    prompt = f"Rewrite the following paragraph in very simple terms and as short as possible for a 10-year-old child with dyslexia. Keep the core meaning the same:\n\n'{text}'"
    response_text = call_ollama(prompt)
    return response_text.strip()

def generate_default_quiz(text):
    """
    Generate a simple fallback quiz if AI fails.
    Creates basic comprehension questions from the text.
    """
    try:
        print("[INFO] Generating fallback quiz from text...")
        
        # Extract simple facts from text
        sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 10]
        
        if len(sentences) < 2:
            return None
        
        questions = []
        
        # Question 1: About the first main sentence
        if len(sentences) > 0:
            first_sentence = sentences[0]
            words = first_sentence.split()
            if len(words) > 2:
                # Create a simple question
                q1 = {
                    "question": f"What is the text mostly about?",
                    "options": [
                        first_sentence[:50] + "..." if len(first_sentence) > 50 else first_sentence,
                        "A story about nature",
                        "A scientific discovery", 
                        "A historical event"
                    ],
                    "answer": first_sentence[:50] + "..." if len(first_sentence) > 50 else first_sentence
                }
                questions.append(q1)
        
        # Question 2: Simple true/false style question
        if len(sentences) > 1:
            q2 = {
                "question": "According to the text, was this information provided?",
                "options": ["Yes, definitely", "No, not mentioned", "Maybe", "Unclear"],
                "answer": "Yes, definitely"
            }
            questions.append(q2)
        
        if len(questions) > 0:
            print(f"[OK] Generated {len(questions)} fallback questions")
            # Randomize options for fallback quiz too
            randomized = randomize_quiz_options(questions)
            return randomized
        
        return None
    except Exception as e:
        print(f"[ERROR] Fallback quiz generation failed: {e}")
        return None


def generate_quiz(text):
    """
    Generate multiple-choice quiz questions based on the provided text.
    Uses as much of the text as possible while respecting model limits.
    Returns a list of quiz questions with options and correct answers.
    """
    
    # Truncate to a reasonable size that the model can handle
    text_to_use = text[:3000].strip() if text else ""
    
    if not text_to_use:
        return {"error": "No text provided for quiz generation"}
    
    # Simplified, more direct prompt for better JSON output with dyslexia-friendly guidelines
    prompt = f"""You are creating a reading quiz for a 10-year-old child with dyslexia.

IMPORTANT RULES:
- Use SHORT and SIMPLE words (avoid complex vocabulary)
- Keep questions under 8 words
- Ask about FACTS from the text only
- Make 4 clearly different answer options
- Randomize position of correct answer (not always in same place)
- Do NOT include tricky or misleading content

Generate 2 multiple-choice questions. Return ONLY a JSON array, no other text.

[
    {{
        "question": "What color was the star?",
        "options": ["Blue", "Red", "Green", "Yellow"],
        "answer": "Blue"
    }}
]

TEXT: {text_to_use}

Return ONLY valid JSON array:"""

    try:
        print("[INFO] Generating quiz from text...")
        json_response_str = call_ollama(prompt, is_json=True)
        
        print(f"[DEBUG] Raw Ollama response length: {len(json_response_str)}")
        
        # Try to extract JSON from response (sometimes models wrap it in extra text)
        json_start = json_response_str.find('[')
        json_end = json_response_str.rfind(']') + 1
        
        if json_start != -1 and json_end > json_start:
            json_str = json_response_str[json_start:json_end]
            print(f"[DEBUG] Extracted JSON: {json_str[:200]}")
            quiz_questions = json.loads(json_str)
        else:
            print("[WARNING] Could not find JSON array in response, attempting direct parse")
            quiz_questions = json.loads(json_response_str)
        
        # Validate the response structure
        if not isinstance(quiz_questions, list):
            print(f"[ERROR] Quiz response is not a list: {type(quiz_questions)}")
            raise ValueError("Response is not a list")
        
        if len(quiz_questions) == 0:
            print("[ERROR] AI returned empty quiz")
            raise ValueError("Empty quiz")
        
        # Validate and clean up questions
        valid_questions = []
        for i, q in enumerate(quiz_questions):
            if not isinstance(q, dict):
                print(f"[WARNING] Question {i} is not a dict, skipping")
                continue
            
            # Check required fields
            if "question" not in q or "options" not in q or "answer" not in q:
                print(f"[WARNING] Question {i} missing required fields")
                continue
            
            # Validate options
            if not isinstance(q.get("options"), list) or len(q.get("options", [])) != 4:
                print(f"[WARNING] Question {i} has invalid options count")
                continue
            
            # Ensure answer is in options
            if q.get("answer") not in q.get("options", []):
                print(f"[WARNING] Question {i} answer not in options")
                continue
            
            valid_questions.append(q)
        
        if len(valid_questions) > 0:
            print(f"[OK] Successfully generated {len(valid_questions)} quiz questions")
            # Randomize the options order to vary correct answer position
            randomized_questions = randomize_quiz_options(valid_questions)
            print(f"[OK] Randomized options for {len(randomized_questions)} questions")
            return randomized_questions
        else:
            print("[ERROR] No valid questions after validation, trying fallback...")
            fallback = generate_default_quiz(text_to_use)
            if fallback:
                return fallback
            return {"error": "Could not generate valid questions"}
        
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON decode error: {e}")
        print(f"[DEBUG] Response preview: {json_response_str[:300]}")
        print("[INFO] Attempting fallback quiz generation...")
        fallback = generate_default_quiz(text_to_use)
        if fallback:
            return fallback
        return {"error": "Invalid JSON from AI model"}
    except Exception as e:
        print(f"[ERROR] Quiz generation error: {type(e).__name__}: {e}")
        print("[INFO] Attempting fallback quiz generation...")
        fallback = generate_default_quiz(text_to_use)
        if fallback:
            return fallback
        return {"error": "Failed to generate quiz"}