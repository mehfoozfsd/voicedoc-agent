// src/lib/vertex.ts
import { VertexAI, GenerativeModel, Content } from '@google-cloud/vertexai';
import tracer from '@/lib/datadog-init';
import { MetricsCollector } from '@/lib/datadog-metrics';

// Lazy initialization to avoid errors during Next.js build
let vertex_ai: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (!vertex_ai) {
    const project = process.env.VERTEX_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    console.log('[Vertex] Initializing with:', { project, location });

    if (!project) {
      throw new Error('[Vertex] VERTEX_PROJECT_ID is required but not set');
    }

    vertex_ai = new VertexAI({
      project: project,
      location: location
    });
  }
  return vertex_ai;
}

const modelName = 'gemini-2.5-flash';

// ============================================================================
// UTILITY: Extract Section/Chapter Text
// ============================================================================
function extractSection(fullText: string, query: string): string | null {
  const numMapper: { [key: string]: string } = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
  };

  const chapterMatch = query.match(/(chapter|section)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
  if (!chapterMatch) {
    return null;
  }

  const sectionType = chapterMatch[1];
  let sectionNumber = chapterMatch[2].toLowerCase();
  if (numMapper[sectionNumber]) {
    sectionNumber = numMapper[sectionNumber];
  }

  const startMarker = new RegExp(`${sectionType}\\s*${sectionNumber}(?::|\\s+[^a-z0-9]?)?`, 'i');

  const nextSectionNumber = parseInt(sectionNumber) + 1;
  const endMarker = new RegExp(`${sectionType}\\s*${nextSectionNumber}(?::|\\s+[^a-z0-9]?)?`, 'i');

  const startIndexMatch = fullText.match(startMarker);
  if (!startIndexMatch) {
    return null;
  }

  const startIndex = startIndexMatch.index! + startIndexMatch[0].length;
  const endIndexMatch = fullText.substring(startIndex).match(endMarker);

  if (endIndexMatch) {
    return fullText.substring(startIndex, startIndex + endIndexMatch.index!).trim();
  } else {
    return fullText.substring(startIndex).trim();
  }
}

// ============================================================================
// PERSONA CLASSIFICATION (WITH METRICS)
// ============================================================================
export async function getClassifiedPersona(documentText: string, trafficType: string = 'user'): Promise<string> {
  return tracer.trace('gemini.persona', async (span) => {
    const model: GenerativeModel = getVertexAI().getGenerativeModel({ model: modelName });

    const prompt = `
      Analyze the following document text and classify it into one of the following personas:
      - legal
      - financial
      - technical
      - academic
      - narrative

      Return ONLY the classification name (lowercase).
      
      Document Text:
      ${documentText.slice(0, 5000)}
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.candidates?.[0].content.parts[0].text;
      const persona = text?.trim().toLowerCase() || 'narrative';

      // 📊 RECORD METRICS
      MetricsCollector.recordPersona(persona, trafficType);

      return persona;
    } catch (error) {
      console.error('[Persona] Error classifying document:', error);
      MetricsCollector.recordError('persona_error', 'standard', trafficType);
      return 'narrative';
    }
  });
}

// ============================================================================
// NON-STREAMING RESPONSE (WITH METRICS)
// ============================================================================
export async function getGeminiResponse(history: Content[], query: string, context: string, trafficType: string = 'user'): Promise<string> {
  const startTime = Date.now();
  return tracer.trace('gemini.request', { resource: 'getGeminiResponse' }, async (span) => {
    const model: GenerativeModel = getVertexAI().getGenerativeModel({ model: modelName });
    MetricsCollector.recordHit('standard', false, trafficType);

    const validHistory: Content[] = history.map((h: any) => ({
      role: h.role,
      parts: h.parts || [{ text: h.text }]
    }));

    span?.setTag('llm.model', modelName);
    span?.setTag('llm.query', query);

    const chat = model.startChat({
      history: validHistory,
      systemInstruction: {
        role: 'system',
        parts: [{
          text: `You are a precision-focused Voice Assistant for proprietary documents.

GROUNDING RULES:
1. You must answer the user's question STRICTLY based on the provided context below.
2. Do NOT use your internal training data to answer unrelated questions or fill in gaps.
3. If the answer is not in the context, say "I cannot find that information in the document."
4. Be concise, direct, and conversational (spoken word style).

CONTEXT:
${context}`
        }]
      }
    });

    try {
      const result = await chat.sendMessage(query);
      const response = await result.response;

      const usage = response.usageMetadata;
      if (usage && usage.promptTokenCount && usage.candidatesTokenCount) {
        span?.setTag('llm.prompt_tokens', usage.promptTokenCount);
        span?.setTag('llm.completion_tokens', usage.candidatesTokenCount);
        span?.setTag('llm.total_tokens', usage.totalTokenCount);
      }

      const text = response.candidates?.[0].content.parts[0].text || "I'm sorry, I couldn't generate a response.";
      span?.setTag('llm.response', text);

      return text;
    } catch (error: any) {
      span?.setTag('error', true);
      span?.setTag('error.message', error.message);

      // 📊 RECORD ERROR METRIC
      MetricsCollector.recordError('non_streaming_error', 'standard', trafficType);

      throw error;
    }
  });
}

// ============================================================================
// FEW-SHOT EXAMPLES FOR EMOTION TAGGING
// ============================================================================
function getFewShotExamples(persona: string): Array<{ userInput: string; expectedOutput: string }> {
  const examples: { [key: string]: Array<{ userInput: string; expectedOutput: string }> } = {
    narrative: [
      {
        userInput: `Add emotion tags to this text:
"Sarah sighed. The stack on her desk seemed to grow taller each day. There has to be a better way, she muttered."`,
        expectedOutput: `Sarah [sigh] sighed. The [wearily] stack on her desk seemed to grow [frustrated] taller each day. [frustrated] There has to be a better way, she [wearily] muttered.`
      },
      {
        userInput: `Add emotion tags to this text:
"Still reading that monster?" Marcus asked. "Have you tried talking to it?" Sarah looked at him like he'd lost his mind.`,
        expectedOutput: `[playfully] "Still reading that monster?" Marcus asked. [intrigued] "Have you tried talking to it?" [stunned] Sarah looked at him like he'd lost his mind.`
      },
      {
        userInput: `Add emotion tags to this text:
"The future of reading isn't reading at all. It's conversation. It's understanding through dialogue rather than silent struggle."`,
        expectedOutput: `[reflectively] "The future of reading isn't reading at all. [warmly] It's conversation. [passionately] It's understanding through dialogue rather than [poetically] silent struggle."`
      }
    ],
    legal: [
      {
        userInput: `Add emotion tags to this text:
"The contract is void under Section 5. The plaintiff argues this is unlawful. The court must decide carefully."`,
        expectedOutput: `The [pauses] contract is void under Section 5. [calm] The plaintiff argues this is [warily] unlawful. [formally] The court must decide carefully.`
      }
    ],
    financial: [
      {
        userInput: `Add emotion tags to this text:
"Your portfolio gained 3 percent. Interest rates are rising. This is positive growth despite market conditions."`,
        expectedOutput: `Your portfolio gained [excited] 3 percent. [pauses] Interest rates are rising. [nervous] This is [calm] positive growth despite market conditions.`
      }
    ],
    technical: [
      {
        userInput: `Add emotion tags to this text:
"Deploy using Docker containers. If the query fails, check the logs carefully. This solution is proven and reliable."`,
        expectedOutput: `Deploy using [pauses] Docker containers. [hesitates] If the query fails, check the logs carefully. [excited] This solution is proven and reliable.`
      }
    ],
    academic: [
      {
        userInput: `Add emotion tags to this text:
"The hypothesis requires further testing. However, limitations exist in our methodology. The results are promising."`,
        expectedOutput: `The [pauses] hypothesis requires [hesitates] further testing. [thoughtfully] However, limitations exist in our methodology. [calmly] The results are promising.`
      }
    ]
  };

  return examples[persona] || examples.narrative;
}

// ============================================================================
// CALL 1: Get the raw response from Gemini (WITH METRICS)
// ============================================================================
async function getGeminiRawResponse(
  history: any[],
  query: string,
  context: string,
  isNarrationRequest: boolean,
  voiceMode: 'standard' | 'expressive' = 'standard',
  trafficType: string = 'user'
): Promise<string> {
  const startTime = Date.now();

  return tracer.trace('gemini.request', { resource: 'getGeminiRawResponse' }, async (span) => {
    span?.setTag('voice_mode', voiceMode);
    console.log('[Call1:getGeminiRawResponse] Getting raw response from Gemini');

    const model: GenerativeModel = getVertexAI().getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      }
    });

    const validHistory: Content[] = history.map((h: any) => ({
      role: h.role,
      parts: h.parts || [{ text: h.text }]
    }));

    let systemPrompt: string;
    let textToRead = context;

    if (isNarrationRequest) {
      const extracted = extractSection(context, query);
      if (extracted) {
        textToRead = extracted;
        console.log('[Call1] Extracted chapter/section');
      }

      systemPrompt = `You are a professional audiobook narrator. Read the following text aloud EXACTLY as written, word-for-word. 

CRITICAL RULES:
1. Do NOT summarize.
2. Do NOT paraphrase.
3. Do NOT skip any words.
4. Output the spoken text ONLY.
5. Do NOT include narration notes, stage directions, or descriptions of tone (e.g., (softly), (muttering), (friendly)).
6. Do NOT include speaker labels.

TEXT TO READ:
${textToRead}`;
    } else {
      systemPrompt = `You are a voice assistant answering questions about a document. Answer based STRICTLY on the provided context. Do NOT use training data to fill gaps.

CONTEXT:
${context}`;
    }

    span?.setTag('llm.model', modelName);
    span?.setTag('llm.is_narration', isNarrationRequest);

    const chat = model.startChat({
      history: validHistory,
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemPrompt }]
      }
    });

    const message = isNarrationRequest && extractSection(context, query)
      ? `Please begin reading.`
      : query;

    try {
      const result = await chat.sendMessage(message);
      const response = await result.response;
      const rawText = response.candidates?.[0].content.parts[0].text || '';

      const usage = response.usageMetadata;
      if (usage && usage.promptTokenCount && usage.candidatesTokenCount) {
        span?.setTag('llm.prompt_tokens', usage.promptTokenCount);
        span?.setTag('llm.completion_tokens', usage.candidatesTokenCount);
        span?.setTag('llm.total_tokens', usage.totalTokenCount);

        // 📊 RECORD METRICS
        MetricsCollector.recordTokens(
          usage.promptTokenCount,
          usage.candidatesTokenCount,
          voiceMode,
          trafficType
        );
        MetricsCollector.recordLLMCost(
          usage.promptTokenCount,
          usage.candidatesTokenCount,
          voiceMode,
          trafficType
        );
      }

      console.log('[Call1] Got raw response, length:', rawText.length);
      return rawText;
    } catch (error: any) {
      span?.setTag('error', true);
      span?.setTag('error.message', error.message);

      // 📊 RECORD ERROR METRIC
      MetricsCollector.recordError('call1_error', voiceMode, trafficType);

      throw error;
    }
  });
}

// ============================================================================
// CALL 2: Add emotion tags using few-shot learning (WITH METRICS)
// ============================================================================
async function addEmotionTagsWithFewShot(
  rawText: string,
  persona: string,
  contextHint?: string,
  voiceMode: 'standard' | 'expressive' = 'expressive',
  trafficType: string = 'user'
): Promise<string> {
  return tracer.trace('gemini.request', { resource: 'addEmotionTagsWithFewShot' }, async (span) => {
    span?.setTag('voice_mode', voiceMode);
    console.log('[Call2:addEmotionTagsWithFewShot] Starting with text length:', rawText.length);

    const model: GenerativeModel = getVertexAI().getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        topP: 0.7,
      }
    });

    const fewShotExamples = getFewShotExamples(persona);

    const history: Content[] = [];
    for (const example of fewShotExamples) {
      history.push({
        role: 'user',
        parts: [{ text: example.userInput }]
      });
      history.push({
        role: 'assistant',
        parts: [{ text: example.expectedOutput }]
      });
    }

    const systemPrompt = `SYSTEM: You add emotion tags to text ONLY. Nothing else.

TAGS ONLY: [excited] [nervous] [frustrated] [sorrowful] [calm] [sigh] [laughs] [gulps] [gasps] [whispers] [pauses] [hesitates] [wearily] [warmly] [playfully] [stunned] [intrigued] [reflectively] [passionately] [poetically]

YOUR JOB:
1. Take input text
2. Add [tag] BEFORE words - no parentheses, no narration notes
3. Keep EVERY word exactly the same
4. Return ONLY the tagged text

NEVER add: (notes), descriptions, or stage directions. 
ONLY add: [emotion_tag] tags in square brackets.`;

    span?.setTag('llm.model', modelName);
    span?.setTag('llm.persona', persona);

    const chat = model.startChat({
      history,
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemPrompt }]
      }
    });

    const userMessage = `Add ONLY emotion tags [like this] to this text. Do NOT add parentheses or narration notes. PRESERVE ALL WORDS:

${rawText}`;

    console.log('[Call2] Sending to Gemini...');

    try {
      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      let taggedText = response.candidates?.[0].content.parts[0].text || rawText;

      const usage = response.usageMetadata;
      if (usage && usage.promptTokenCount && usage.candidatesTokenCount) {
        span?.setTag('llm.prompt_tokens', usage.promptTokenCount);
        span?.setTag('llm.completion_tokens', usage.candidatesTokenCount);
        span?.setTag('llm.total_tokens', usage.totalTokenCount);

        // 📊 RECORD METRICS
        MetricsCollector.recordTokens(
          usage.promptTokenCount,
          usage.candidatesTokenCount,
          voiceMode,
          trafficType
        );
        MetricsCollector.recordLLMCost(
          usage.promptTokenCount,
          usage.candidatesTokenCount,
          voiceMode,
          trafficType
        );
      }

      taggedText = taggedText.replace(/\([^)]*?\)/g, '').trim();

      console.log('[Call2] After cleanup, length:', taggedText.length);

      return taggedText;
    } catch (error: any) {
      span?.setTag('error', true);
      span?.setTag('error.message', error.message);

      // 📊 RECORD ERROR METRIC
      MetricsCollector.recordError('call2_error', voiceMode, trafficType);

      throw error;
    }
  });
}

// ============================================================================
// STREAMING RESPONSE (WITH METRICS)
// ============================================================================
export async function* getGeminiStream(
  history: Content[],
  query: string,
  context: string,
  isNarrationRequest: boolean = false,
  expressiveMode: boolean = false,
  persona: string = 'narrative',
  trafficType: string = 'user'
) {
  const startTime = Date.now();
  console.log('[getGeminiStream] 🚀 Starting two-call process', { expressiveMode, persona, trafficType });

  try {
    console.log('[getGeminiStream] Is narration request:', isNarrationRequest);

    // CALL 1: Get raw response
    console.log('[getGeminiStream] ========== CALL 1: RAW RESPONSE ==========');
    const voiceMode = expressiveMode ? 'expressive' : 'standard';

    const rawResponse = await getGeminiRawResponse(history, query, context, isNarrationRequest, voiceMode, trafficType);

    console.log('[getGeminiStream] CALL 1 OUTPUT (length:', rawResponse.length, ')');

    if (!rawResponse.trim()) {
      yield 'No response generated.';

      // 📊 RECORD METRICS
      const duration = Date.now() - startTime;

      return;
    }

    // CALL 2: Add emotion tags if expressive mode
    let finalResponse: string;
    if (expressiveMode) {
      console.log('[getGeminiStream] ========== CALL 2: ADD EMOTION TAGS ==========');

      finalResponse = await addEmotionTagsWithFewShot(rawResponse, persona, undefined, voiceMode, trafficType);

      console.log('[getGeminiStream] CALL 2 OUTPUT (length:', finalResponse.length, ')');
    } else {
      // Cleanup any hallucinations like (narrative tone) or [pauses] that might leak in Standard mode
      finalResponse = rawResponse.replace(/\([^)]*?\)/g, '').replace(/\[[^\]]*?\]/g, '').trim();
      console.log('[getGeminiStream] Standard mode - cleanup applied and Call 2 skipped');
    }

    console.log('[getGeminiStream] ✅ Complete, yielding final response');

    yield finalResponse;
  } catch (error) {
    console.error('[getGeminiStream] ❌ Fatal error:', error);

    // 📊 RECORD ERROR
    MetricsCollector.recordError('fatal_error', expressiveMode ? 'expressive' : 'standard', trafficType);

    if (error instanceof Error) {
      console.error('[getGeminiStream] Message:', error.message);
      console.error('[getGeminiStream] Stack:', error.stack);
    }

    yield `\n\nERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    throw error;
  }
}