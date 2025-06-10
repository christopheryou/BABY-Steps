require('dotenv').config(); // Load variables into process.env
const path = require('path');
const jsonDir = path.resolve(__dirname, './json')
const apiKey = process.env.OPENAI_API_KEY;
const googleAudioApiKey = process.env.GOOGLE_API_KEY
const elevenLabsAudioApiKey = process.env.ELEVEN_LABS_API_KEY;
const vectorStoreId = process.env.VECTOR_STORE_ID;

// ===== Scenario Configurations =====
// Currently configured as if using Google Voice. If you'd like to swap this, simply set the characterVoice properties to reflect this.
const scenario = {
    largeLanguageModel: {
        model: "gpt-4o-mini",
        apiKey: apiKey || "N/A",
        systemPrompt: `You are an assistant who answers questions about ACM HAI.`
    },
    characterAvatar: {
        body: "F" || "M", // Female or Male Body
        cameraView: "full", // full, mid, upper, head
        mood: "neutral",
        name: "BABY Assistant",
        path: path.join('characters', 'avaturn.glb'),
    },
    characterVoice: {
        type: "elevenLabs" || "google",
        model: "aMSt68OGf4xUZAnLpTU8" || "en-US-Neural2-F", // Two random voice models, Google (en-US-Neural-2) and ElevenLabs (aMSt68OGf4xUZAnLpTU8)
        apiKey: elevenLabsAudioApiKey || googleAudioApiKey,
        googleTtsEndpoint: "/Interaction/Google", // Default - Does not need to be changed unless you rename endpoint
        elevenLabsTtsEndpoint: "/Interaction/ElevenLabs" // Default ^
    },
    conversationScript: {
        type: "Scripted" || "Open",
        path: path.join(jsonDir,'BABYScriptWithAudio.json'),
        useKnowledgeBase: true,
    },
    verbalBackchannels: {
        enabled: false,
        path: path.join(jsonDir,'VerbalBackchannels.json')
    },
    researcherEmail: "email@email.com", // In case you want to provide front-end users with your email, in case anything breaks.
    templateType: "panel-view" || "chatlog-view", // Front-end conversation rendering -- with history or without history
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