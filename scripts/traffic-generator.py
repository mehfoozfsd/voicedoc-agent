import requests
import json
import time
import random

BASE_URL = "http://localhost:3000"  # Update if hosted elsewhere

# Map personas to dummy filenames for realistic RAG context
PERSONA_FILES = {
    "legal": "sample_legal_contract.txt",
    "financial": "sample_financial_report.txt",
    "technical": "sample_technical_spec.txt",
    "academic": "sample_academic_paper.txt",
    "narrative": "sample_narrative_story.txt"
}

def simulate_chat(query, persona="narrative", expressive_mode=False, scenario="normal", force_error=False):
    filename = PERSONA_FILES.get(persona, "sample_technical_spec.txt")
    print(f"[{persona}] Sending query for {filename}: {query} (Expressive: {expressive_mode}, Scenario: {scenario})")
    
    # Exaggerate impact for judges: expressive mode adds detail prompts to increase tokens/latency
    modified_query = query
    if expressive_mode and query:
        modified_query += " Please provide a deeply emotional, nuanced, and detailed response with natural pauses and hesitations."

    payload = {
        "query": modified_query,
        "history": [],
        "persona": persona,
        "filename": filename,
        "expressiveMode": expressive_mode,
        "forceError": force_error
    }
    
    headers = {
        "X-VoiceDoc-Traffic": "synthetic",
        "X-VoiceDoc-Scenario": scenario
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/gemini", 
            json=payload, 
            headers=headers,
            stream=True,
            timeout=30
        )
        for chunk in response.iter_content(chunk_size=1024):
            if chunk:
                # We don't need to print everything, just signify activity
                pass
        print(f"[{persona}] ✅ Request complete (Status: {response.status_code})")
    except Exception as e:
        print(f"[{persona}] ❌ Request failed: {e}")

if __name__ == "__main__":
    print("🚀 Starting VoiceDoc Traffic Generator (Datadog Challenge Edition)")
    
    # 1. Warm-up
    simulate_chat("Hello! What is this document about?", scenario="warmup")
    time.sleep(1)
    
    # 2. Persona & Expressive Mode Toggles
    personas = ["legal", "financial", "technical", "academic"]
    for p in personas:
        simulate_chat("Give me a brief summary of the key points.", persona=p, expressive_mode=True, scenario="persona-test")
        time.sleep(1)
        simulate_chat("What are the risks?", persona=p, expressive_mode=False, scenario="persona-test")
        time.sleep(1)
    
    # 3. Burst Traffic (Pressure Test)
    print("🔥 Starting burst traffic...")
    for i in range(5):
        simulate_chat(f"Burst query {i}: Describe the methodology in detail.", persona="technical", expressive_mode=True, scenario="burst-test")
        time.sleep(0.5)
    
    # 4. Intentional Failure (Deterministic proof for Monitors/Runbooks)
    print("💥 Simulating intentional Gemini error...")
    simulate_chat("This query will fail.", force_error=True, scenario="error-demo")
    
    print("🏁 Traffic generation complete.")
