import os
import json
import random
import re
from groq import Groq

# Groq (https://console.groq.com) - free tier, no local model required.
# Reads GROQ_API_KEY and GROQ_MODEL from the environment/.env - never hardcode
# a key here. Note: llama-3.3-70b-versatile was deprecated by Groq (Aug 2026);
# openai/gpt-oss-120b is their recommended general-purpose replacement.
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
#
# IMPORTANT: both the key AND the model name are read LAZILY (inside
# _get_groq_client / call_ai, below) rather than at import time. app.py
# imports this module before it calls load_dotenv(), so reading os.getenv()
# at module load time would always see an empty environment even when
# .env is set up correctly - this bit us once already for GROQ_API_KEY,
# so GROQ_MODEL gets the same treatment to avoid the identical trap.
_groq_client = None
_groq_warned = False

def _get_groq_client():
    """Lazily create (and cache) the Groq client on first real use, after
    the app has finished starting up and .env has definitely been loaded."""
    global _groq_client, _groq_warned
    if _groq_client is not None:
        return _groq_client
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        if not _groq_warned:
            print("[WARN] GROQ_API_KEY not set - AI features (definitions, simplify, quiz) "
                  "will fall back to offline/basic behavior instead of using an LLM. "
                  "Get a free key at https://console.groq.com/keys and add it to your .env file.")
            _groq_warned = True
        return None
    _groq_client = Groq(api_key=api_key)
    return _groq_client

def is_hindi_text(text):
    """
    Detect if the text contains Hindi language.
    Hindi characters are in Unicode range: U+0900 to U+097F (Devanagari script)
    """
    if not text:
        return False
    
    hindi_pattern = r'[\u0900-\u097F]'
    hindi_matches = re.findall(hindi_pattern, text)
    
    # If more than 5% of characters are Hindi, consider it Hindi text
    if len(hindi_matches) > len(text) * 0.05:
        print(f"[INFO] Detected Hindi text - Found {len(hindi_matches)} Hindi characters out of {len(text)} total")
        return True
    
    return False

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

def call_ai(prompt, is_json=False):
    """Call the Groq API (cloud LLM) instead of a local Ollama instance.
    Keeps the same return contract as before: a plain string response,
    or a JSON string with an "error" key on failure, so every caller in
    this file works unchanged."""
    client = _get_groq_client()
    if client is None:
        return json.dumps({"error": "AI features are unavailable - GROQ_API_KEY is not configured."})
    try:
        completion = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7 if is_json else 0.5,
            max_tokens=1024,
            timeout=30
        )
        return completion.choices[0].message.content or ""
    except Exception as e:
        print(f"Groq API request failed: {e}")
        return json.dumps({"error": "The AI service is temporarily unavailable. Please try again."})

def get_word_definition(word):
    prompt = f"""You are explaining a word to a child aged 8-10 with dyslexia.

Word: "{word}"

Write ONE single sentence that tells what this word means.
- Use only simple, everyday words a child already knows
- No examples, no extra sentences, just the meaning
- Keep it under 15 words
- Do NOT start with "Meaning:" or any label — just write the sentence directly"""
    response_text = call_ai(prompt)
    return response_text.strip()

def simplify_paragraph(text):
    prompt = f"""You are helping a child with dyslexia (age 8-12) understand a passage.

Your job:
1. Read the passage below
2. Write a SHORT, SIMPLE summary in 2-3 sentences MAXIMUM
3. Use only easy, everyday words (no big vocabulary)
4. Use short sentences (under 10 words each)
5. Keep the main idea but throw away confusing details
6. Write like you are telling a friend what happened in the passage
7. Do NOT copy sentences from the original - rewrite completely in simple words

Passage:
{text}

Write the simple summary now (2-3 short sentences only):"""
    response_text = call_ai(prompt)
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
    Dynamically adjusts question count based on text length.
    Returns a list of quiz questions with options and correct answers.
    """
    
    # Truncate to a reasonable size that the model can handle
    text_to_use = text[:3000].strip() if text else ""
    
    if not text_to_use:
        return {"error": "No text provided for quiz generation"}
    
    # Dynamic question count based on text length
    word_count = len(text_to_use.split())
    if word_count > 200:
        num_questions = 5
    elif word_count > 100:
        num_questions = 4
    elif word_count > 50:
        num_questions = 3
    else:
        num_questions = 2

    print(f"[INFO] Text has {word_count} words, generating {num_questions} questions")
    
    import random as _random
    # Pick varied question starters so every quiz feels different
    question_starters = [
        "Who", "What", "Where", "When", "Why", "How",
        "Which", "What kind of", "What did", "What does"
    ]
    _random.shuffle(question_starters)
    starter_hint = ", ".join(question_starters[:5])

    # Improved prompt for kid-friendly, varied quiz generation
    prompt = f"""You are a fun, friendly teacher making a reading quiz for a child aged 8-12 with dyslexia.

CRITICAL RULES:
- Create EXACTLY {num_questions} questions — all DIFFERENT from each other
- Each question must start with a DIFFERENT question word. Try using words like: {starter_hint}
- Questions MUST be based on FACTS directly in the text — no guessing
- Keep questions SHORT and SIMPLE (under 12 words, easy vocabulary)
- Each question must have EXACTLY 4 answer choices
- Only ONE choice is correct — make wrong choices clearly wrong (not tricky or confusing)
- Wrong choices must be plausible but obviously incorrect to a child who read the text
- Use FUN, friendly language — like a teacher talking to a child
- NEVER repeat the same question or same topic twice
- Do NOT ask questions that are too similar to each other

Return ONLY a valid JSON array. No extra text, no explanation.

Example format:
[
    {{
        "question": "What did the dog find in the park?",
        "options": ["A ball", "A cat", "A bone", "A shoe"],
        "answer": "A bone"
    }},
    {{
        "question": "Where did the story happen?",
        "options": ["At school", "In the park", "At home", "In a shop"],
        "answer": "In the park"
    }}
]

TEXT TO MAKE QUIZ FROM:
{text_to_use}

Now create {num_questions} DIFFERENT questions as a JSON array:"""

    try:
        print("[INFO] Generating quiz from text...")
        json_response_str = call_ai(prompt, is_json=True)
        
        print(f"[DEBUG] Raw Groq response length: {len(json_response_str)}")
        
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