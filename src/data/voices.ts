export interface VoiceConfig {
  value: string;
  label: string;
  provider: 'vapi' | 'deepgram';
  gender: 'masculine' | 'feminine';
  audioUrl?: string;
  description?: string;
  useCase?: string;
}

// Classic voices
export const vapiVoices: VoiceConfig[] = [
  { value: 'Elliot', label: 'Elliot', provider: 'vapi', gender: 'masculine'},
  { value: 'Rohan', label: 'Rohan', provider: 'vapi', gender: 'masculine' },
  { value: 'Savannah', label: 'Savannah', provider: 'vapi', gender: 'feminine' },
  { value: 'Leah', label: 'Leah', provider: 'vapi', gender: 'feminine' },
  { value: 'Tara', label: 'Tara', provider: 'vapi', gender: 'feminine' },
  { value: 'Jess', label: 'Jess', provider: 'vapi', gender: 'feminine' },
  { value: 'Leo', label: 'Leo', provider: 'vapi', gender: 'masculine' },
  { value: 'Dan', label: 'Dan', provider: 'vapi', gender: 'masculine' },
  { value: 'Mia', label: 'Mia', provider: 'vapi', gender: 'feminine' },
  { value: 'Zac', label: 'Zac', provider: 'vapi', gender: 'masculine' },
  { value: 'Zoe', label: 'Zoe', provider: 'vapi', gender: 'feminine' },
];

// Premium voices (with audio previews and detailed descriptions)
export const deepgramVoices: VoiceConfig[] = [
  { value: 'amalthea', label: 'Amalthea', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-amalthea.wav', description: 'Engaging, Natural, Cheerful', useCase: 'Casual chat' },
  { value: 'apollo', label: 'Apollo', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-apollo.wav', description: 'Confident, Comfortable, Casual', useCase: 'Casual chat' },
  { value: 'arcas', label: 'Arcas', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-arcas.wav', description: 'Natural, Smooth, Clear, Comfortable', useCase: 'Customer service, casual chat' },
  { value: 'aries', label: 'Aries', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-aries.wav', description: 'Warm, Energetic, Caring', useCase: 'Casual chat' },
  { value: 'asteria', label: 'Asteria', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-asteria.wav', description: 'Clear, Confident, Knowledgeable, Energetic', useCase: 'Advertising' },
  { value: 'athena', label: 'Athena', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-athena.wav', description: 'Calm, Smooth, Professional', useCase: 'Storytelling' },
  { value: 'atlas', label: 'Atlas', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-atlas.wav', description: 'Enthusiastic, Confident, Approachable, Friendly', useCase: 'Advertising' },
  { value: 'aurora', label: 'Aurora', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-aurora.wav', description: 'Cheerful, Expressive, Energetic', useCase: 'Interview' },
  { value: 'callista', label: 'Callista', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-callista.wav', description: 'Clear, Energetic, Professional, Smooth', useCase: 'IVR' },
  { value: 'cora', label: 'Cora', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-cora.wav', description: 'Smooth, Melodic, Caring', useCase: 'Storytelling' },
  { value: 'cordelia', label: 'Cordelia', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-cordelia.wav', description: 'Approachable, Warm, Polite', useCase: 'Storytelling' },
  { value: 'delia', label: 'Delia', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-delia.wav', description: 'Casual, Friendly, Cheerful, Breathy', useCase: 'Interview' },
  { value: 'draco', label: 'Draco', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-draco.wav', description: 'Warm, Approachable, Trustworthy, Baritone', useCase: 'Storytelling' },
  { value: 'electra', label: 'Electra', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-electra.wav', description: 'Professional, Engaging, Knowledgeable', useCase: 'IVR, advertising, customer service' },
  { value: 'harmonia', label: 'Harmonia', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-harmonia.wav', description: 'Empathetic, Clear, Calm, Confident', useCase: 'Customer service' },
  { value: 'helena', label: 'Helena', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-helena.wav', description: 'Caring, Natural, Positive, Friendly, Raspy', useCase: 'IVR, casual chat' },
  { value: 'hera', label: 'Hera', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-hera.wav', description: 'Smooth, Warm, Professional', useCase: 'Informative' },
  { value: 'hermes', label: 'Hermes', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-hermes.wav', description: 'Expressive, Engaging, Professional', useCase: 'Informative' },
  { value: 'hyperion', label: 'Hyperion', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-hyperion.wav', description: 'Caring, Warm, Empathetic', useCase: 'Interview' },
  { value: 'iris', label: 'Iris', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-iris.wav', description: 'Cheerful, Positive, Approachable', useCase: 'IVR, advertising, customer service' },
  { value: 'janus', label: 'Janus', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-janus.wav', description: 'Southern, Smooth, Trustworthy', useCase: 'Storytelling' },
  { value: 'juno', label: 'Juno', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-juno.wav', description: 'Natural, Engaging, Melodic, Breathy', useCase: 'Interview' },
  { value: 'jupiter', label: 'Jupiter', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-jupiter.wav', description: 'Expressive, Knowledgeable, Baritone', useCase: 'Informative' },
  { value: 'luna', label: 'Luna', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-luna.wav', description: 'Friendly, Natural, Engaging', useCase: 'IVR' },
  { value: 'mars', label: 'Mars', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-mars.wav', description: 'Smooth, Patient, Trustworthy, Baritone', useCase: 'Customer service' },
  { value: 'minerva', label: 'Minerva', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-minerva.wav', description: 'Positive, Friendly, Natural', useCase: 'Storytelling' },
  { value: 'neptune', label: 'Neptune', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-neptune.wav', description: 'Professional, Patient, Polite', useCase: 'Customer service' },
  { value: 'odysseus', label: 'Odysseus', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-odysseus.wav', description: 'Calm, Smooth, Comfortable, Professional', useCase: 'Advertising' },
  { value: 'ophelia', label: 'Ophelia', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-ophelia.wav', description: 'Expressive, Enthusiastic, Cheerful', useCase: 'Interview' },
  { value: 'orion', label: 'Orion', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-orion.wav', description: 'Approachable, Comfortable, Calm, Polite', useCase: 'Informative' },
  { value: 'orpheus', label: 'Orpheus', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-orpheus.wav', description: 'Professional, Clear, Confident, Trustworthy', useCase: 'Customer service, storytelling' },
  { value: 'pandora', label: 'Pandora', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-pandora.wav', description: 'Smooth, Calm, Melodic, Breathy', useCase: 'IVR, informative' },
  { value: 'phoebe', label: 'Phoebe', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-phoebe.wav', description: 'Energetic, Warm, Casual', useCase: 'Customer service' },
  { value: 'pluto', label: 'Pluto', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-pluto.wav', description: 'Smooth, Calm, Empathetic, Baritone', useCase: 'Interview, storytelling' },
  { value: 'saturn', label: 'Saturn', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-saturn.wav', description: 'Knowledgeable, Confident, Baritone', useCase: 'Customer service' },
  { value: 'selene', label: 'Selene', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-selene.wav', description: 'Expressive, Engaging, Energetic', useCase: 'Informative' },
  { value: 'thalia', label: 'Thalia', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-thalia.wav', description: 'Clear, Confident, Energetic, Enthusiastic', useCase: 'Casual chat, customer service, IVR' },
  { value: 'theia', label: 'Theia', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-theia.wav', description: 'Expressive, Polite, Sincere', useCase: 'Informative' },
  { value: 'vesta', label: 'Vesta', provider: 'deepgram', gender: 'feminine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-vesta.wav', description: 'Natural, Expressive, Patient, Empathetic', useCase: 'Customer service, interview, storytelling' },
  { value: 'zeus', label: 'Zeus', provider: 'deepgram', gender: 'masculine', audioUrl: 'https://static.deepgram.com/examples/Aura-2-zeus.wav', description: 'Deep, Trustworthy, Smooth', useCase: 'IVR' },
];

export const allVoices: VoiceConfig[] = [...vapiVoices, ...deepgramVoices];
