import requests
import os
import json

OLLAMA_URL = "http://host.docker.internal:11434/api/generate"
MODEL_NAME = "mistral"

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

def generate_quiz(text):
    # --- THIS IS THE IMPROVED PROMPT ---
    prompt = f"""
    Based on the following text, create 2 multiple-choice questions suitable for a child.
    Return ONLY a valid JSON array of objects. Do not include any other text, explanations, or markdown.
    Each object must have three keys: "question", "options" (an array of 4 strings), and "answer".

    Here is an example of the required JSON format:
    [
        {{
            "question": "What is the color of the sky?",
            "options": ["Blue", "Green", "Red", "Yellow"],
            "answer": "Blue"
        }}
    ]

    Now, generate the questions based on this text: "{text[:1500]}"
    """
    try:
        json_response_str = call_ollama(prompt, is_json=True)
        return json.loads(json_response_str)
    except (json.JSONDecodeError, TypeError) as e:
        print(f"Quiz generation JSON error: {e}")
        return {"error": "The local model failed to generate a valid quiz in JSON format."}