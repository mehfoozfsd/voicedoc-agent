// src/app/page.tsx
'use client';

import { datadogRum } from '@datadog/browser-rum';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Send, FileText, Mic, X, Volume2, Settings, Scale, DollarSign, Code, GraduationCap, BookOpen, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOICE_ID_MAPPING, Persona } from '@/lib/elevenlabs';
import { VoiceAgentMetricsCollector, VoiceAgentMetrics } from '@/lib/metrics';
import { MetricsSidebar } from '@/components/MetricsSidebar';
import { MicPermissionModal } from '@/components/MicPermissionModal';

// Types for Web Speech API
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  mode?: 'expressive' | 'standard';
}

// Helper function to get supported MIME type
const getSupportedMimeType = (): { mimeType: string; extension: string } => {
  const types = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
    { mimeType: 'audio/mp4', extension: 'mp4' },
    { mimeType: 'audio/mpeg', extension: 'mp3' },
  ];

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type.mimeType)) {
      console.log(`Using supported MIME type: ${type.mimeType}`);
      return type;
    }
  }

  // Fallback - let browser choose
  console.warn('No explicitly supported MIME type found, using default');
  return { mimeType: '', extension: 'webm' };
};

// Helper function to get persona icon and color
const getPersonaVisuals = (persona: Persona) => {
  const visuals = {
    legal: { icon: Scale, color: 'blue', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', textColor: 'text-blue-400' },
    financial: { icon: DollarSign, color: 'green', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', textColor: 'text-green-400' },
    technical: { icon: Code, color: 'cyan', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', textColor: 'text-cyan-400' },
    academic: { icon: GraduationCap, color: 'amber', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', textColor: 'text-amber-400' },
    narrative: { icon: BookOpen, color: 'purple', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', textColor: 'text-purple-400' }
  };
  return visuals[persona];
};

const EMOTION_TAGS = {
  'Emotional States': ['[excited]', '[nervous]', '[frustrated]', '[sorrowful]', '[calm]'],
  'Reactions': ['[sigh]', '[laughs]', '[gulps]', '[gasps]', '[whispers]'],
  'Cognitive Beats': ['[pauses]', '[hesitates]', '[stammers]', '[resigned tone]'],
  'Tone Cues': ['[cheerfully]', '[flatly]', '[deadpan]', '[playfully]']
};


export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileNameRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ingested, setIngested] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [orbMode, setOrbMode] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const [isListening, setIsListening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Mic Permissions Modal State
  const [showMicModal, setShowMicModal] = useState(false);
  const [micErrorType, setMicErrorType] = useState<'permission' | 'not-found' | 'unknown'>('unknown');

  // Metrics State
  const metricsCollector = useRef(new VoiceAgentMetricsCollector());
  const [metrics, setMetrics] = useState<Partial<VoiceAgentMetrics>>({});

  // Helper to force update metrics UI
  const updateMetrics = useCallback(() => {
    setMetrics(metricsCollector.current.getMetrics());
  }, []);

  // Persona Settings State
  const [currentPersona, setCurrentPersona] = useState<Persona>('narrative');
  const personaRef = useRef<Persona>('narrative'); // Ref to avoid closure issues
  const [showPersonaSettings, setShowPersonaSettings] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<string>(EMOTION_TAGS['Emotional States'][0]);
  const [isExpressiveMode, setIsExpressiveMode] = useState(false);

  // Mic Test Lab - Separate State
  const [isTestListening, setIsTestListening] = useState(false);
  const [testLastError, setTestLastError] = useState<string | null>(null);
  const [testRecognizedText, setTestRecognizedText] = useState('');
  const [showTestLab, setShowTestLab] = useState(false); // Toggle visibility

  // Main Chat Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Mic Test Lab - Separate Refs
  const testMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const testAudioChunksRef = useRef<Blob[]>([]);
  const testStreamRef = useRef<MediaStream | null>(null);

  // Latest Transcribe Function Ref (Fix for Stale Closure)
  const transcribeAudioRef = useRef<((audioBlob: Blob) => Promise<void>) | null>(null);

  // Scroll to bottom of chat
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Initialize Main Chat Audio Recording
  const initializeAudio = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const { mimeType, extension } = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.onstart = () => {
        metricsCollector.current.startUserSpeech();
        metricsCollector.current.startVadDetection();
        updateMetrics();
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('[Main Chat] 📥 Audio chunk received, size:', event.data.size);
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        metricsCollector.current.endVadDetection(0.95); // Simulated confidence
        updateMetrics();

        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        audioChunksRef.current = [];
        console.log('[Main Chat] Audio recorded, transcribing...', actualMimeType);

        // Fix: Use ref to call the latest version of transcribeAudio (accessing latest history state)
        if (transcribeAudioRef.current) {
          await transcribeAudioRef.current(audioBlob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      setLastError(null); // Clear any previous errors
    } catch (error: any) {

      let type: 'permission' | 'not-found' | 'unknown' = 'unknown';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        type = 'permission';
        console.warn('[Main Chat] Microphone permission denied:', error);
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        type = 'not-found';
        console.warn('[Main Chat] Microphone not found:', error);
      } else {
        console.error('[Main Chat] Failed to initialize:', error);
      }

      setMicErrorType(type);
      setShowMicModal(true);
      setLastError('Could not access microphone');
    }
  }, []); // Dependencies

  useEffect(() => {
    initializeAudio();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeAudio]);

  // Initialize Test Lab Audio Recording (Separate)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initTestMediaRecorder = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          testStreamRef.current = stream;

          const { mimeType, extension } = getSupportedMimeType();
          const options = mimeType ? { mimeType } : {};
          const mediaRecorder = new MediaRecorder(stream, options);

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              console.log('[Test Lab] 📥 Audio chunk received, size:', event.data.size);
              testAudioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = async () => {
            const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(testAudioChunksRef.current, { type: actualMimeType });
            testAudioChunksRef.current = [];
            console.log('[Test Lab] Audio recorded, transcribing...', actualMimeType);
            await transcribeTestAudio(audioBlob);
          };

          testMediaRecorderRef.current = mediaRecorder;
        } catch (error) {
          console.error('[Test Lab] Failed to initialize:', error);
          setTestLastError('Could not access microphone');
        }
      };

      initTestMediaRecorder();
    }

    return () => {
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Main Chat Transcription
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      console.log('[Main Chat] 📤 Sending audio to /api/transcribe, size:', audioBlob.size);
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      metricsCollector.current.startStt();
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      metricsCollector.current.recordFirstSttToken(); // For non-streaming, this is same as end

      if (res.ok && data.text) {
        console.log('[Main Chat] ✅ Transcribed:', data.text);
        metricsCollector.current.completeStt(0.98); // High confidence for success
        updateMetrics();

        setQuery(data.text);
        handleSend(data.text, true); // Pass true to indicate this came from voice
      } else {
        const errorMsg = data.details || data.error || 'No speech detected';
        console.error('[Main Chat] Transcription failed:', errorMsg);
        setLastError(errorMsg);
      }
    } catch (error) {
      console.error('[Main Chat] ❌ Error:', error);
      setLastError(error instanceof Error ? error.message : 'Transcription failed');
    } finally {
      setIsListening(false);
      setOrbMode('idle');
    }
  };

  // Keep ref updated
  useEffect(() => {
    transcribeAudioRef.current = transcribeAudio;
  }, [transcribeAudio]);

  // Test Lab Transcription (Separate)
  const transcribeTestAudio = async (audioBlob: Blob) => {
    try {
      console.log('[Test Lab] 📤 Sending audio to /api/transcribe, size:', audioBlob.size);
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.text) {
        console.log('[Test Lab] ✅ Transcribed:', data.text);
        setTestRecognizedText(data.text);
        setTestLastError(null);
      } else {
        const errorMsg = data.details || data.error || 'No speech detected';
        console.error('[Test Lab] Transcription failed:', errorMsg);
        setTestLastError(errorMsg);
      }
    } catch (error) {
      console.error('[Test Lab] ❌ Error:', error);
      setTestLastError(error instanceof Error ? error.message : 'Transcription failed');
    } finally {
      setIsTestListening(false);
    }
  };

  const toggleMic = () => {
    if (!mediaRecorderRef.current) {
      alert("Microphone not initialized");
      return;
    }

    if (isListening) {
      mediaRecorderRef.current.stop();
    } else {
      audioChunksRef.current = [];
      setIsListening(true);
      setOrbMode('listening');
      setLastError(null);
      mediaRecorderRef.current.start(200); // Record in 200ms chunks

      datadogRum.addAction('Voice Input Toggle', { status: 'started' });
    }
  };

  const playAudioResponse = async (text: string, persona?: Persona) => {
    try {
      metricsCollector.current.startTts();

      // Use ref to get the latest persona value, avoiding closure issues
      const voicePersona = persona || personaRef.current;
      console.log('🔊 Playing TTS with persona:', voicePersona, '| Voice:', VOICE_ID_MAPPING[voicePersona].name, '| Mode:', isExpressiveMode ? 'Expressive (v3)' : 'Standard (Flash v2.5)');

      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          persona: voicePersona,
          expressiveMode: isExpressiveMode
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('TTS Server Error:', errorData);
        throw new Error(errorData.error || 'TTS Failed');
      }

      const audioBlob = await response.blob();
      metricsCollector.current.recordFirstByte();

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onplay = () => {
        setOrbMode('speaking');
        // Record when audio actually starts playing (true perceivable latency)
        metricsCollector.current.recordAgentResponseStart();
        updateMetrics();
      };

      audio.onended = () => {
        setOrbMode('idle');
        metricsCollector.current.recordAgentResponseComplete(audio.duration);
        metricsCollector.current.completeTts(text.length, audio.duration, audioBlob.size);
        updateMetrics();
      };

      audio.play();
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      fileNameRef.current = selectedFile.name;
      setUploading(true);
      setOrbMode('processing');

      const formData = new FormData();
      formData.append('file', selectedFile);

      datadogRum.addAction('Document Upload Start', {
        filename: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      });

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          console.log('Upload success:', data);
          console.log('[Upload] Filename stored:', selectedFile.name);
          setIngested(true);
          // Store the detected persona FIRST before playing audio
          const detectedPersona = (data.persona as Persona) || 'narrative';
          console.log('🎭 Detected persona:', detectedPersona);
          setCurrentPersona(detectedPersona);
          personaRef.current = detectedPersona; // Update ref immediately

          const welcomeMessage = `I've processed ${selectedFile.name}. I'm ready to answer questions about it.`;
          setHistory(prev => [...prev, { role: 'model', text: welcomeMessage }]);

          // Play audio with the detected persona
          playAudioResponse(welcomeMessage, detectedPersona);
        } else {
          console.error('Upload failed');
          setFile(null);
          setFileName(null);
          fileNameRef.current = null;
          alert('Upload failed. Please try again.');
        }
      } catch (error) {
        console.error('Error uploading:', error);
        alert('An error occurred during upload.');
        setFile(null);
        setFileName(null);
        fileNameRef.current = null;
      } finally {
        setUploading(false);
        setOrbMode('idle');
      }
    }
  };

  const handleSend = async (manualQuery?: string, fromVoice: boolean = false) => {
    const textToSend = manualQuery || query;
    if (!textToSend.trim()) return;

    setQuery('');

    const userMessage = { role: 'user' as const, text: textToSend };
    const updatedHistory = [...history, userMessage];

    setHistory(updatedHistory);
    setLoading(true);
    setOrbMode('processing');

    // Only reset metrics if this is a fresh text query (not from voice)
    if (!fromVoice) {
      metricsCollector.current.reset();
      // Start E2E timing for text queries
      metricsCollector.current.startUserSpeech();
      updateMetrics();
    }

    metricsCollector.current.startLlm();

    try {
      console.log('[handleSend] 🚀 Initiating request to /api/gemini');

      console.log('[handleSend] 📤 History being sent:', {
        historyLength: updatedHistory.length,
        messages: updatedHistory.map(h => ({
          role: h.role,
          textPreview: h.text.substring(0, 50)
        }))
      });

      const activeFilename = fileNameRef.current;
      const contextText = activeFilename ? `(User has uploaded ${activeFilename})` : '';

      console.log('[handleSend] 📤 Sending filename:', {
        activeFilename,
        refValue: fileNameRef.current
      });

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: updatedHistory,
          query: textToSend,
          context: contextText,
          filename: activeFilename,
          persona: currentPersona, // Pass the active persona
          expressiveMode: isExpressiveMode
        }),
      });

      datadogRum.addAction('Gemini Query Start', {
        query: textToSend.substring(0, 100),
        persona: currentPersona,
        expressiveMode: isExpressiveMode,
        hasFilename: !!activeFilename
      });

      console.log('[handleSend] 📥 Response received, status:', res.status, 'ok:', res.ok);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      if (!res.body) throw new Error('Response body is empty');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let firstChunk = true;

      // Add a placeholder message for the streaming response
      // Capture the mode at the time of sending to persist it with the message
      const responseMode = isExpressiveMode ? 'expressive' : 'standard';
      setHistory(prev => [...prev, { role: 'model', text: '', mode: responseMode }]);

      console.log('[handleSend] 🌊 Starting stream reading...');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;

        // Record TTFT on first chunk
        if (firstChunk && chunk.trim()) {
          console.log('[handleSend] ⏱️ TTFT reached!');
          metricsCollector.current.recordFirstLlmToken();
          metricsCollector.current.recordAgentResponseStart();
          updateMetrics();
          firstChunk = false;
        }

        // Update chat history with accumulated response
        setHistory(prev => {
          const newHistory = [...prev];
          const lastMsg = newHistory[newHistory.length - 1];
          if (lastMsg.role === 'model') {
            lastMsg.text = fullResponse;
          } else {
            return [...prev, { role: 'model', text: fullResponse, mode: responseMode }];
          }
          return newHistory;
        });

        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
      console.log('[handleSend] ✅ Stream complete. Total length:', fullResponse.length);

      // Calculate final token metrics
      const inputTokens = textToSend.length / 4;
      const outputTokens = fullResponse.length / 4;
      metricsCollector.current.completeLlm(Math.ceil(inputTokens), Math.ceil(outputTokens));
      updateMetrics();

      if (fullResponse) {
        playAudioResponse(fullResponse);
      } else {
        setHistory(prev => [...prev, { role: 'model', text: "I'm sorry, I couldn't get a response.", mode: 'standard' }]);
        setOrbMode('idle');
      }
    } catch (error) {
      console.error('[handleSend] ❌ Search error:', error);
      setHistory(prev => [...prev, { role: 'model', text: "Error connecting to the agent.", mode: 'standard' }]);
      setOrbMode('idle');
    } finally {
      setLoading(false);
    }
  };

  const clearDocument = () => {
    setFile(null);
    setFileName(null);
    setIngested(false);
    setHistory([]);
    setCurrentPersona('narrative');
    personaRef.current = 'narrative';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="flex min-h-screen flex-col relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Modern Header */}
      <header className="w-full border-b border-white/10 bg-black/20 backdrop-blur-xl z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">VoiceDoc Agent</h1>
                <p className="text-xs text-gray-400 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                    Powered by Vertex AI
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                    ElevenLabs Voice
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${ingested
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                }`}>
                <div className={`w-2 h-2 rounded-full ${ingested ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                <span className="text-xs font-medium">{ingested ? 'Document Ready' : 'No Document'}</span>
              </div>
              {currentPersona && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getPersonaVisuals(currentPersona).bgColor} ${getPersonaVisuals(currentPersona).borderColor}`}>
                  {React.createElement(getPersonaVisuals(currentPersona).icon, { className: `w-3.5 h-3.5 ${getPersonaVisuals(currentPersona).textColor}` })}
                  <span className={`text-xs font-semibold ${getPersonaVisuals(currentPersona).textColor}`}>{VOICE_ID_MAPPING[currentPersona].name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area with Sidebar */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex overflow-hidden">

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 lg:px-8 py-6 relative">
          {/* Upload Section (when no document) */}
          <AnimatePresence>
            {!ingested && !uploading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex items-center justify-center"
              >
                <label className="flex flex-col items-center gap-6 cursor-pointer group">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                    <div className="relative p-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-white/10 group-hover:border-white/20 transition-all duration-300 backdrop-blur-sm">
                      <Upload className="w-16 h-16 text-indigo-400" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-200 group-hover:text-white transition-colors mb-2">
                      Upload Your Document
                    </p>
                    <p className="text-sm text-gray-500">
                      PDF, TXT, or Markdown files supported
                    </p>
                  </div>
                  <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.txt,.md" />
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          {uploading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30 mx-auto animate-pulse">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <p className="text-indigo-300 font-mono text-sm">
                  Ingesting Document & Generating Embeddings...
                </p>
              </div>
            </div>
          )}

          {/* Chat Interface (when document is ingested) */}
          {ingested && (
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              {/* File Info Badge */}
              {file && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20">
                      <FileText className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{file.name}</p>
                      <p className="text-xs text-gray-500">Document loaded and ready</p>
                    </div>
                  </div>
                  <button
                    onClick={clearDocument}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group"
                    title="Remove document"
                  >
                    <X className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
                  </button>
                </motion.div>
              )}

              {/* Chat Messages */}
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 min-h-0" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                {history.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center mb-4 mx-auto">
                        <Mic className="w-8 h-8 text-indigo-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">Ready to Chat</h3>
                      <p className="text-sm text-gray-500">
                        Ask me anything about your document using voice or text
                      </p>
                    </div>
                  </div>
                ) : (
                  history.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-600/30 to-indigo-600/10 border border-indigo-500/30 text-indigo-50 rounded-br-sm shadow-lg shadow-indigo-500/10'
                        : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-sm backdrop-blur-sm'
                        }`}>
                        {msg.text}
                      </div>

                      {/* Mode Indicator Icon */}
                      {msg.role === 'model' && (
                        <div className="ml-2 mt-1 self-start flex flex-col items-center group/icon">
                          <div className={`p-1.5 rounded-full backdrop-blur-md border shadow-lg ${msg.mode === 'expressive'
                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                            {msg.mode === 'expressive' ? (
                              <Sparkles className="w-3 h-3" />
                            ) : (
                              <Zap className="w-3 h-3" />
                            )}
                          </div>

                          {/* Tooltip */}
                          <div className="absolute left-0 -bottom-8 opacity-0 group-hover/icon:opacity-100 transition-opacity bg-black/90 border border-white/10 text-[10px] text-gray-300 px-2 py-1 rounded whitespace-nowrap pointer-events-none z-20">
                            {msg.mode === 'expressive' ? 'Generated in Expressive Mode' : 'Generated in Standard Mode'}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-500" />
                <div className="relative flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-xl p-2">
                  <button
                    onClick={toggleMic}
                    className={`p-4 rounded-xl transition-all ${isListening
                      ? 'bg-red-500/20 text-red-400 animate-pulse shadow-lg shadow-red-500/20'
                      : 'hover:bg-white/10 text-gray-400 hover:text-white'
                      }`}
                    title={isListening ? 'Stop recording' : 'Start voice input'}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your document..."
                    disabled={loading}
                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-base text-white placeholder-gray-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!query.trim() || loading}
                    className="p-4 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
                    title="Send message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Metrics Sidebar */}
        <div className="hidden lg:block h-full">
          <MetricsSidebar metrics={metrics} />
        </div>

      </div>

      {/* Mic Permission Modal */}
      <MicPermissionModal
        isOpen={showMicModal}
        onClose={() => setShowMicModal(false)}
        onRetry={() => {
          setShowMicModal(false);
          initializeAudio();
        }}
        errorType={micErrorType}
      />

      {/* Mic Test Lab Toggle */}
      {!showTestLab ? (
        <button
          onClick={() => setShowTestLab(true)}
          className="z-10 fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-600/50 rounded-full text-gray-300 text-sm font-medium shadow-lg backdrop-blur-sm transition-all hover:scale-105"
        >
          <Mic className="w-4 h-4 text-indigo-400" />
          Open Mic Test Lab
        </button>
      ) : (
        <div className="z-10 p-6 rounded-xl bg-zinc-900/90 border border-zinc-700/50 backdrop-blur-xl w-full max-w-2xl shadow-2xl">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
            <p className="font-bold text-gray-200 text-lg flex items-center gap-2">
              <Mic className="w-5 h-5 text-indigo-400" />
              Mic Test Lab (Standalone)
            </p>
            <div className="flex items-center gap-4">
              <div className="flex gap-4 text-xs font-mono">
                <div>Status: <span className="text-indigo-300">{isTestListening ? 'RECORDING' : 'IDLE'}</span></div>
                {testLastError && <div className="text-red-400">Error: {testLastError}</div>}
              </div>
              <button
                onClick={() => setShowTestLab(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Close Test Lab"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
              {!isTestListening ? (
                <button
                  onClick={() => {
                    if (testMediaRecorderRef.current) {
                      console.log('[Test Lab] Starting test recording...');
                      testAudioChunksRef.current = [];
                      setTestRecognizedText('');
                      setTestLastError(null);
                      setTestLastError(null);
                      setIsTestListening(true);
                      testMediaRecorderRef.current.start(200); // Chunk every 200ms
                    } else {
                      setTestLastError('Test recorder not initialized');
                    }
                  }}
                  className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
                >
                  <Mic className="w-6 h-6" /> Start Mic Test
                </button>
              ) : (
                <button
                  onClick={() => {
                    console.log('[Test Lab] User stopping test');
                    if (testMediaRecorderRef.current) {
                      testMediaRecorderRef.current.stop();
                    }
                  }}
                  className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-lg shadow-red-500/30 transition-all animate-pulse"
                >
                  <X className="w-6 h-6" /> Stop Recording
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">captured speech</label>
              <div className="p-4 rounded-lg bg-black/50 border border-white/10 min-h-[60px] text-gray-200 font-mono text-sm leading-relaxed">
                {testRecognizedText || (isTestListening ? <span className="text-gray-600 italic">Listening...</span> : <span className="text-gray-700 italic">No speech captured yet.</span>)}
              </div>

              {testRecognizedText && (
                <div className="flex justify-end">
                  <button
                    onClick={() => playAudioResponse(testRecognizedText)}
                    className="flex items-center gap-2 text-xs px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-indigo-300 rounded-md border border-white/5 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" /> Play Sample (TTS)
                  </button>
                </div>
              )}
            </div>

            <div className="text-[10px] text-center text-gray-600">
              Browser Status: {isTestListening ? 'Active (Recording)' : 'Inactive'} | Results: {testRecognizedText ? 'Captured ✓' : 'Empty'}
            </div>

            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-gray-400 mb-2 font-semibold">⚠️ Troubleshooting Tips:</p>
              <ul className="text-xs text-gray-500 space-y-1 ml-2">
                <li>• Check browser microphone permissions (Chrome top-left corner)</li>
                <li>• Speak clearly and loudly after clicking "Start Mic Test"</li>
                <li>• Chrome/Edge work best. Firefox may have issues.</li>
                <li>• Make sure microphone is plugged in and not muted</li>
                <li>• Wait 1-2 seconds after clicking Start before speaking</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Persona Settings Toggle */}
      {!showPersonaSettings ? (
        <button
          onClick={() => setShowPersonaSettings(true)}
          className="z-10 fixed bottom-20 right-4 flex items-center gap-2 px-4 py-3 bg-purple-800/90 hover:bg-purple-700/90 border border-purple-600/50 rounded-full text-gray-300 text-sm font-medium shadow-lg backdrop-blur-sm transition-all hover:scale-105"
        >
          <Settings className="w-4 h-4 text-purple-400" />
          Persona Settings
        </button>
      ) : (
        <div className="z-10 p-6 rounded-xl bg-zinc-900/90 border border-zinc-700/50 backdrop-blur-xl w-full max-w-2xl shadow-2xl">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
            <div>
              <p className="font-bold text-gray-200 text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Persona Settings
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Current: <span className="text-purple-300 font-semibold">{VOICE_ID_MAPPING[currentPersona].name}</span>
              </p>
            </div>
            <button
              onClick={() => setShowPersonaSettings(false)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Close Persona Settings"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-3">
              Voice personas are automatically selected based on your document type. Preview each voice below:
            </p>

            {(Object.keys(VOICE_ID_MAPPING) as Persona[]).map((persona) => {
              const voiceConfig = VOICE_ID_MAPPING[persona];
              const isActive = currentPersona === persona;

              // Color coding for different personas
              const getPersonaColor = (p: Persona) => {
                switch (p) {
                  case 'legal': return 'blue';
                  case 'financial': return 'green';
                  case 'technical': return 'cyan';
                  case 'academic': return 'amber';
                  case 'narrative': return 'purple';
                  default: return 'gray';
                }
              };

              const color = getPersonaColor(persona);

              return (
                <div
                  key={persona}
                  className={`p-4 rounded-lg border transition-all ${isActive
                    ? `bg-${color}-900/30 border-${color}-500/50 shadow-lg shadow-${color}-500/20`
                    : 'bg-black/30 border-white/10 hover:bg-white/5'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-sm ${isActive ? `text-${color}-300` : 'text-gray-200'}`}>
                          {voiceConfig.name}
                        </h3>
                        {isActive && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${color}-500/20 text-${color}-300 border border-${color}-500/30`}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 capitalize">
                        <span className="font-mono text-gray-500">{persona}</span> • {voiceConfig.description}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const sampleText = `Hello, I'm your ${persona} assistant. I'll help you understand your document.`;
                        playAudioResponse(sampleText, persona);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all hover:scale-105 ${isActive
                        ? `bg-${color}-600 hover:bg-${color}-500 text-white shadow-md`
                        : 'bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-white/10'
                        }`}
                    >
                      <Volume2 className="w-3 h-3" />
                      Preview
                    </button>
                  </div>
                </div>
              );
            })}

            <div className={`p-4 rounded-lg border transition-all mb-4 flex items-center justify-between ${isExpressiveMode
              ? 'bg-purple-900/20 border-purple-500/30'
              : 'bg-zinc-800/50 border-white/10'}`}>

              <div>
                <h3 className={`font-semibold text-sm flex items-center gap-2 ${isExpressiveMode ? 'text-purple-300' : 'text-gray-300'}`}>
                  {isExpressiveMode ? <Sparkles className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  Expressive Mode
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isExpressiveMode
                    ? 'Enabled: High-quality, emotional speech (slower).'
                    : 'Disabled: Ultra-fast, standard speech.'}
                </p>
              </div>

              <button
                onClick={() => setIsExpressiveMode(!isExpressiveMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isExpressiveMode ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
              >
                <span
                  className={`${isExpressiveMode ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
            </div>

            <div className="pt-4 border-t border-white/10 mt-4">
              <p className="text-xs text-gray-400 mb-2 font-semibold">🎭 Emotion Lab:</p>
              <div className="bg-black/30 rounded-lg p-4 border border-white/5 space-y-3">
                <p className="text-xs text-gray-500">
                  Test how the current voice handles different emotional tags. Select a tag and click "Test Emotion".
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={selectedEmotion}
                    onChange={(e) => setSelectedEmotion(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-white/10 text-gray-200 text-sm rounded-md px-3 py-2 outline-none focus:border-indigo-500/50"
                  >
                    {Object.entries(EMOTION_TAGS).map(([category, tags]) => (
                      <optgroup key={category} label={category}>
                        {tags.map(tag => (
                          <option key={tag} value={tag}>{tag}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      const sampleText = `${selectedEmotion} I can't believe we're finally doing this! This is going to be interesting.`;
                      playAudioResponse(sampleText, currentPersona);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                  >
                    <Volume2 className="w-4 h-4" />
                    Test Emotion
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 mt-4">
              <p className="text-xs text-gray-400 mb-2 font-semibold">ℹ️ How it works:</p>
              <ul className="text-xs text-gray-500 space-y-1 ml-2">
                <li>• Upload a document to automatically detect its persona type</li>
                <li>• The system will use the matching voice for all responses</li>
                <li>• Click "Preview" to hear a sample of each voice</li>
                <li>• Different personas provide distinct speaking styles and tones</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}