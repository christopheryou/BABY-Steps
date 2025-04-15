require('dotenv').config(); // Load variables into process.env
const path = require('path');
const jsonDir = path.resolve(__dirname, './json')
const apiKey = process.env.OPENAI_API_KEY;
const audioApiKey = process.env.GOOGLE_API_KEY || process.env.ELEVEN_LABS_API_KEY;
const vectorStoreId = process.env.VECTOR_STORE_ID;

// ===== Scenario Configurations =====
// Currently configured as if using Google Voice. If you'd like to swap this, simply set the characterVoice properties to reflect this.
const scenario = {
    largeLanguageModel: {
        model: "gpt-4o-mini",
        apiKey: apiKey || "N/A",
        systemPrompt: "You are a virtual assistant who's goal is to help answer questions succinctly. Address the incoming user messages accurately and succinctly."
    },
    characterAvatar: {
        body: "F" || "M", // Female or Male Body
        cameraView: "upper", // full, mid, upper, head
        mood: "neutral",
        name: "CHARACTER_NAME",
        path: path.join('characters', 'female_avatar.glb'),
    },
    characterVoice: {
        type: "google" || "elevenLabs",
        model: "en-US-Neural2-F" || "YqApuarN9Z1zDLV3DTEA", //Two random voice models, first one is Google, second is ElevenLabs
        apiKey: audioApiKey || "N/A",
        googleTtsEndpoint: "/Interaction/Google", // Default - Does not need to be changed unless you rename endpoint
        elevenLabsTtsEndpoint: "/Interaction/ElevenLabs" // Default ^
    },
    conversationScript: {
        type: "Open" || "Scripted",
        path: path.join(jsonDir,'OpenConversationScript.json')
    },
    verbalBackchannels: {
        enabled: false,
        path: path.join(jsonDir,'VerbalBackchannels.json')
    },
    researcherEmail: "email@email.com", // In case you want to provide front-end users with your email, in case anything breaks.
    templateType: "conversation-log" || "caption", // Front-end conversation rendering -- with history or without history
    vectorStoreId: vectorStoreId || "N/A",
}

// This is what is sent to the front-end, this does NOT need to be modified when you update scenario {}
const safeScenario = {
    characterAvatar: scenario.characterAvatar,
    characterVoiceType: scenario.characterVoice.type,
    ttsEndpoint: (scenario.characterVoice.type === "google") ? scenario.characterVoice.googleTtsEndpoint : scenario.characterVoice.elevenLabsTtsEndpoint,
    ttsVoice: scenario?.characterVoice?.model,
    researcherEmail: scenario.researcherEmail,
    templateType: scenario.templateType,
    verbalBackchannelsEnabled: scenario.verbalBackchannels.enabled,
}

module.exports = {
    scenario,
    safeScenario
  };