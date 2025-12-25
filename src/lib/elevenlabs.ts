export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export type Persona = 'legal' | 'financial' | 'technical' | 'academic' | 'narrative';

export interface VoiceConfig {
    id: string;
    name: string;
    description: string;
}

export const VOICE_ID_MAPPING: Record<Persona, VoiceConfig> = {
    legal: {
        id: 'jfIS2w2yJi0grJZPyEsk', // Oliver Silk - Deep Gravel Narrative
        name: 'Professional Legal',
        description: 'Authoritative and clear'
    },
    financial: {
        id: 'x70vRnQBMBu4FAYhjJbO', // Nathan Fence - V3 agent
        name: 'Financial Advisor',
        description: 'Confident and trustworthy'
    },
    technical: {
        id: 'wWWn96OtTHu1sn8SRGEr', // Hale - Expressive, Deep and Emotive
        name: 'Technical Expert',
        description: 'Clear and precise'
    },
    academic: {
        id: 'BZgkqPqms7Kj9ulSkVzn', // Eve - Authentic, Engergetive and Happy
        name: 'Academic Scholar',
        description: 'Thoughtful and articulate'
    },
    narrative: {
        id: 'L0yTtpRXzdyzQlzALhgD', // Marissa
        name: 'Storyteller',
        description: 'Warm and engaging'
    }
};

// Helper function to get voice ID for a persona
export function getVoiceIdForPersona(persona: Persona = 'narrative'): string {
    return VOICE_ID_MAPPING[persona]?.id || VOICE_ID_MAPPING.narrative.id;
}
