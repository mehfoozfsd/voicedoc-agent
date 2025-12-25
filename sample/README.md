# Sample Documents

Sample documents for testing VoiceDoc Agent with different personas.

## Files

- **`sample_academic_paper.txt`** - Academic document (triggers "academic" persona)
- **`sample_financial_report.txt`** - Financial document (triggers "financial" persona)
- **`sample_legal_contract.txt`** - Legal document (triggers "legal" persona)
- **`sample_narrative_story.txt`** - Narrative/storytelling document (triggers "narrative" persona)
- **`sample_technical_spec.txt`** - Technical document (triggers "technical" persona)

## Usage

Upload any of these files to test:
- Document classification
- Persona-specific voice responses
- RAG (Retrieval-Augmented Generation)
- Expressive mode differences

## Customization

To customize the voice IDs for each persona:
1. Open `src/lib/elevenlabs.ts`
2. Update the `VOICE_ID_MAPPING` with your preferred ElevenLabs voice IDs
3. Test each voice using the Preview button in Persona Settings

## Notes

- All sample documents are fictional and created for testing purposes
- Documents are designed to have clear, distinct characteristics for reliable classification
- The Gemini model analyzes the first 5000 characters for classification
- Voice selection happens automatically based on the detected persona
