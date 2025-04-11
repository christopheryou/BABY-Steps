const express = require('express');
const session = require('express-session');
const path = require('path');
// Adjust path to root
const { generateOpenConversationScript } = require("./Utils.js");
const { ElevenLabsClient } = require('elevenlabs');

// Used to generate responses
const OpenAI = require('openai');
const { scenario } = require('../scenario.js');
const apiKey = scenario?.largeLanguageModel?.apiKey || "N/A";
const vectorStoreId = scenario?.vectorStoreId || "N/A";
const model = scenario?.largeLanguageModel?.model || "N/A";
const audioApiKey = scenario?.characterVoice?.apiKey || "N/A";
const audioModel = scenario?.characterVoice?.model || "N/A";


// Used to Speed Up Audio (if needed)
const fs = require('fs');

// Export Router
const router = express.Router()
router.use(express.static(path.join(__dirname, 'front-end')));

router.use(session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        maxAge: 1000 * 60 * 15
    }
}));


let verbalBackchannels;
let scriptData;
initConversationScript();
initVerbalBackchannels();

// generateOpenConversationScript("www.google.com");

router.post('/Dialogue', async (req, res, next) => {
    if (!req.session.params)
        await initSession(req);

    var responseData = {};
    if (scenario?.conversationScript?.type === "Open") {
        responseData = await getOpenResponse(req);
    }
    else if (scenario?.conversationScript?.type === "Scripted") {
        responseData = await getScriptedResponse(req);
        
    }
    // console.log(responseData);
    res.setHeader('Content-Type', 'application/json'); 
    return res.json(responseData);
    
});

router.post('/ElevenLabs', async (req, res) => {
    const { text } = req.body;
    if (!text) {
        console.error("No text to generate audio provided!");
        return res.status(400).json({ error: 'Missing text object' });
    }
    if (!audioApiKey || audioApiKey == "N/A") {
        console.error("No audio api key found!");
        return res.status(400).json({ error: 'Missing api key object' });
    }
    if (!audioModel || audioModel == "N/A") {
        return res.status(400).json({ error: 'Missing model object' });
    }
    const {audioBase64, words, wtimes, wdurations} = await generateElevenLabsTTS(text, audioModel);
    res.json({ audioBase64: audioBase64, words: words, wtimes: wtimes, wdurations: wdurations });
})


router.post('/Google', async (req, res) => {
    const { ssml, voice, pitch } = req.body;
    if (!ssml) {
        return res.status(400).json({ error: 'Missing ssml object' });
    }
    const apiKey = scenario?.characterVoice?.apiKey
    if (!apiKey || apiKey === "N/A") {
        return res.status(400).json({ error: 'Missing api key object' });
    }
    var voiceReceived = voice;
    if (!voice || voice === "N/A") {
        voiceReceived = audioModel;
    }
    const audioResponse = await generateGoogleTTS(ssml, voiceReceived, pitch, apiKey);
    res.json({ audioResponse });
})



// ===================
// getOpenResponse(req) Definition
// ===================
// Send calls to this route if you want to use the system for open-ended conversations
// Examples: Chatbots, FAQ Answering + Knowledge Base
async function getOpenResponse(req) {
    const nodeName = req.body?.nodeName;
    try {
        const conversationScript = scriptData;
        const node = conversationScript[nodeName]

        if (!node) {
            console.error(`Node with name ${nodeName} not found.`);
            return res.status(404).json({ error: `Node with name ${nodeName} not found` });
        }

        req.session.params.messages = req.session.params.messages || [];
        const userInput = req.body?.userInput;

        if (nodeName !== "START_FLAG" && nodeName !== "END_FLAG") 
            req.session.params.messages.push({ role: 'user', content: userInput });

        const messages = req.session?.params?.messages;
        const generatedDialogue = (nodeName !== "START_FLAG" && nodeName !== "END_FLAG")
            ? await generateKnowledgeBaseResponse(messages, vectorStoreId, apiKey, model)
            : null;

        if (generatedDialogue && generatedDialogue !== "") {
            const assistantMessage = { role: 'assistant', content: generatedDialogue };
            req.session.params.messages.push(assistantMessage);
        }

        return responseData = {
            nodeName: nodeName,
            dialogue: generatedDialogue,
            input: node?.input,
        }
    }
    catch(err) {
        console.error("Error in Open Response: ", err);
    }
}


// ===================
// Scripted Route Definition
// ===================
// Send calls to this route if you have a semi-guided or fully-guided structure to your conversation.
// Example usages: Character-driven interactions (e.g., interviews), educational content
// For the specific fields of the conversation script, please follow the documentation in the "BABY Conversation Script" tab of the Google Doc: https://docs.google.com/document/d/1k__te_etVll1PAxjq89d9KBEcs2wxFdqJkIXIEYUo3E/edit?tab=t.yr1n5iys64iz
async function getScriptedResponse(req) {
    const nodeName = req.body?.nodeName;
    try {

        const conversationScript = scriptData;
        const node = conversationScript[nodeName]

        if (!node) {
            console.error(`Node with name ${nodeName} not found.`);
            return res.status(404).json({ error: `Node with name ${nodeName} not found` });
        }

        req.session.params.messages = req.session.params.messages || [];
        const userInput = req.body?.userInput;

        if (nodeName !== "START_FLAG" && nodeName !== "END_FLAG")
            req.session.params.messages.push({ role: 'user', content: userInput });

        const dialogue = node.response?.dialogue;
        const useAi = node.response?.useAi;
        var characterDialogue = "";

        if (useAi) {
            const messages = req.session?.params?.messages;

            const prependAiDialogue = useAi?.prependAiDialogue;
            const modifyDialogue = useAi?.modifyDialogue;
            const appendAiDialogue = useAi?.appendAiDialogue;
            const generatedDialogues = [];

            // Grabs the system level prompt of the conversation.
            const mainPrompt = messages[0].content;

            if (modifyDialogue) {
                const prompt = modifyDialogue?.prompt;
                const modifyPrompt = `${mainPrompt}
                
                Given the following dialogue, modify or vary it based on the following prompt: ${prompt}
                
                Dialogue to Modify: ${dialogue}`;

                const messagesForModify = [...messages, { role: 'system', content: modifyPrompt }];
                const generatedDialogue = await generateResponse(messagesForModify);
                generatedDialogues.push(generatedDialogue);
            }
            else {
                if (dialogue && dialogue !== "")
                    generatedDialogues.push(dialogue);
            }
            if (prependAiDialogue) {
                const prompt = prependAiDialogue?.prompt;
                const prependAiPrompt = `${mainPrompt}
                
                Generate a response to the user that will be pre-pended to the verbatim sentence below based on the attached prompt.
                
                Dialogue to Prepend To: ${generatedDialogues && generatedDialogues.length > 0 ? generatedDialogues[0] : 'No dialogue attached, simply create a pre-pended responses.'}
                
                Prompt: ${prompt}
                
                STRICT: ONLY OUTPUT THE DIALOGUE TO PREPEND TO IN YOUR RESPONSE. DO NOT INCLUDE THE DIALOGUE YOU WILL BE PREPENDING TO.`;

                const messagesForPrepend = [...messages, { role: 'system', content: prependAiPrompt }];
                const generatedDialogue = await generateResponse(messagesForPrepend);
                generatedDialogues.push(generatedDialogue);
            }
            if (appendAiDialogue) {
                const prompt = appendAiDialogue?.prompt;
                const appendAiPrompt = `${mainPrompt}
                
                Generate a response to the user that will be appended to the verbatim sentence below based on the attached prompt.
                
                Dialogue to Append To: ${generatedDialogues && generatedDialogues.length > 0 ? generatedDialogues[0] : 'No dialogue attached, simply create an appended responses.'}  

                Prompt: ${prompt}
                
                STRICT: ONLY OUTPUT THE DIALOGUE TO APPEND TO IN YOUR RESPONSE. DO NOT INCLUDE THE DIALOGUE YOU WILL BE APPENDING TO.`;

                const messagesForAppend = [...messages, { role: 'system', content: appendAiPrompt }];
                const generatedDialogue = await generateResponse(messagesForAppend);
                generatedDialogues.push(generatedDialogue);
            }
            characterDialogue = generatedDialogues.join(" ");
        }
        else {
            if (dialogue && dialogue !== "")
                characterDialogue = dialogue;
        }

        const responseData = {
            nodeName: nodeName,
            input: {},
        };

        responseData.dialogue = characterDialogue;
        if (nodeName !== "START_FLAG" && nodeName !== "END_FLAG") {
            const assistantMessage = { role: 'assistant', content: characterDialogue };
            req.session.params.messages.push(assistantMessage);
        }


        if (node.input?.text) {
            responseData.input.text = {
                nextNode: node.input.text.nextNode
            }
        }

        if (node.input?.button) {
            responseData.input.button = {
                selectMultiple: node.input.button.selectMultiple,
                options: node.input.button.options
            }
        }

        if (node.additionalMedia) {
            const mediaType = node?.additionalMedia?.mediaType
            const link = node?.additionalMedia?.link
            // TODO: Modify this.
            if (mediaType && (mediaType === "Image" || mediaType === "PDF")) {
                const accessibleLink = await getSignedUrlFromS3(link);
                if (accessibleLink) {
                    responseData.additionalMedia = {
                        mediaType: mediaType,
                        link: accessibleLink
                    }
                }

            }
            else
                responseData.additionalMedia = node.additionalMedia
        }

        return responseData;
    } catch (err) {
        console.error('Error during request processing:', err);
        return res.status(500).json({ error: 'Failed to process request' });
    }
}

async function generateKnowledgeBaseResponse(messages) {
    try {
        console.log("Generating message potentially using knowledge base...");        
        const requestPayload = {
            model: model,
            input: messages,
        };
        
        if (vectorStoreId && vectorStoreId !== "N/A") {
            requestPayload.tools = [{
                type: "file_search",
                vector_store_ids: [vectorStoreId],
            }];
        }
        const openai = new OpenAI({ apiKey });

        const response = await openai.responses.create(requestPayload);
        console.log("Generated Response: ", response);
        return response.output_text;
    }

    catch (err) {
        console.log(err);
    }
}

async function generateResponse(messages) {
    try {
        console.log("Generating message with knowledge base...");  
        const requestPayload = {
            model: model,
            input: messages
        };      
        const openai = new OpenAI({ apiKey });
        const response = await openai.responses.create(requestPayload);
        console.log("Generated Response: ", response);
        return response.output_text;
    } catch (err) {
        if (err) {
            console.log(err);
        }
    }
}

async function generateElevenLabsTTS(text, model) {
    const client = new ElevenLabsClient({ apiKey: audioApiKey });
    
    const response = await client.textToSpeech.convertWithTimestamps(model, {
        text: text
    });

    const audioBase64 = response?.audio_base64;
    const characterStartTimes = response?.alignment?.character_start_times_seconds;
    const characterEndTimes = response?.alignment?.character_end_times_seconds;
    const { words, wtimes, wdurations } = getWordTimings(text, characterStartTimes, characterEndTimes);
    // console.log( words, wtimes, wdurations);
    return { audioBase64: audioBase64, words: words, wtimes: wtimes, wdurations: wdurations };

}

function getWordTimings(text, characterStartTimes, characterEndTimes) {
    const words = [];
    const wtimes = [];
    const wdurations = [];

    let currentWord = '';
    let wordStartTime = null;
    let wordEndTime = null;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const start = characterStartTimes[i];
        const end = characterEndTimes[i];

        // TODO: Do I need to subtract (-150) from wtimes like in BABY Steps?

        if (char.trim() !== '') {
            // Non-space character
            if (currentWord === '') {
                wordStartTime = start; // Start of a new word
            }
            currentWord += char;
            wordEndTime = end;
        }

        // If it's a space or last character, finalize the word
        if ((char === ' ' || i === text.length - 1) && currentWord !== '') {
            const cleanedWord = currentWord.replace(/[^\w\s]|_/g, "").replace(/\s+/g, "");

            words.push(cleanedWord);
            wtimes.push(Math.round(1000 * wordStartTime - 150));
            wdurations.push(Math.round(1000 * (wordEndTime - wordStartTime)));
            currentWord = '';
        }
    }

    return { words, wtimes, wdurations };
}

async function generateGoogleTTS(ssml, model = null, pitch = null) {

    // Convert text to SSML
    const o = {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
            "input": {
                "ssml": ssml
            },
            "voice": {
                "languageCode": "en-US",
                "name": model
            },
            "audioConfig": {
                "audioEncoding": "OGG_OPUS",
                "speakingRate": 1.15,
                "pitch": pitch
            },
            "enableTimePointing": ["SSML_MARK"]
        })
    };

    const ttsEndpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${audioApiKey}`;
    const res = await fetch(ttsEndpoint, o);
    const data = await res.json();
    if (!res.ok) {
        console.error("Google TTS API Error:", data); // Log detailed error message
    }
    if (res.status == 200 && data && data.audioContent) {
        return data; // ✅ Return `data` directly, no wrapping
    }
}
  
function initConversationScript() {
    if (!scenario?.conversationScript?.path) {
        scriptData = []; // Fallback to empty data
        return;
    }
    try {
        scriptData = JSON.parse(fs.readFileSync(scenario.conversationScript.path, 'utf8'));
        console.log("Successfully preloaded script metadata.");
    } catch (err) {
        console.error("Error reading or parsing CompleteConversationScript.json", err);
        scriptData = []; // Fallback to empty data
    }
}

function initVerbalBackchannels() {
    if (!scenario.verbalBackchannels.enabled) {
        verbalBackchannels = []; // Fallback to empty data
        return;
    }
    try {
        verbalBackchannels = JSON.parse(fs.readFileSync(scenario.verbalBackchannels.path, 'utf8'));
        console.log("Successfully preloaded placeholders data.");
    } catch (err) {
        console.error("Error reading or parsing Placeholders.json:", err);
        verbalBackchannels = []; // Fallback to empty data
    }
}

async function initSession(req) {
    if (!req.session.params)
        req.session.params = {};
    if (!req.session.params.messages) {
        req.session.params.messages = []
        var systemMessage = "You are a virtual assistant who's goal is to help answer questions succinctly. Address the incoming user messages accurately and succinctly.";
        var systemObject = {
            role: "system",
            content: systemMessage
        }
        req.session.params.messages.push(systemObject);
    }
}


module.exports = router;