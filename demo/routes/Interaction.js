const express = require('express');
const session = require('express-session');
const path = require('path');
// Adjust path to root
const { getRandomVerbalBackchannel, generateGoogleTTS, generateElevenLabsTTS } = require('./Audio');
const { initVerbalBackchannels, initConversationScript } = require('./ScriptGeneration');
const { generateResponse, generateKnowledgeBaseResponse } = require('./OpenAI')


const { scenario } = require('../scenario.js');
const systemPrompt = scenario?.largeLanguageModel?.systemPrompt || "N/A";
const audioApiKey = scenario?.characterVoice?.apiKey || "N/A";
const audioModel = scenario?.characterVoice?.model || "N/A";
const verbalBackchannelsEnabled = scenario?.verbalBackchannels?.enabled;

// Export Router
const router = express.Router()
router.use(express.static(path.join(__dirname, 'public')));

router.use(session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        maxAge: 1000 * 60 * 15
    }
}));


let verbalBackchannels = initVerbalBackchannels();
let scriptData = initConversationScript();


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
    console.log("Calling audio");
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
    const { audioBase64, words, wtimes, wdurations } = await generateElevenLabsTTS(text);
    res.json({ audioBase64: audioBase64, words: words, wtimes: wtimes, wdurations: wdurations });
})


router.post('/Google', async (req, res) => {
    const { ssml, voice, pitch } = req.body;
    if (!ssml) {
        return res.status(400).json({ error: 'Missing ssml object' });
    }
    if (!audioApiKey || audioApiKey === "N/A") {
        return res.status(400).json({ error: 'Missing api key object' });
    }
    var voiceReceived = voice;
    if (!voice || voice === "N/A") {
        voiceReceived = audioModel;
        if (!voiceReceived || voiceReceived === "N/A") {
            return res.status(400).json({ error: 'Missing api key object' });
        }
    }

    const audioResponse = await generateGoogleTTS(ssml, voiceReceived, pitch);
    res.json({ audioResponse });
})

router.get('/VerbalBackchannel', async (req, res) => {
    console.log("In Verbal Backchannels");
    if (verbalBackchannelsEnabled && verbalBackchannelsEnabled == true && verbalBackchannels.length !== 0) {
        let backChannel = getRandomVerbalBackchannel(verbalBackchannels);
        console.log(backChannel);
        return res.json(backChannel);
    }
    else {
        return res.status(400).json({ error: 'Missing backchannels ' });
    }
});




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
            ? await generateKnowledgeBaseResponse(messages)
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
    catch (err) {
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
        // console.log(node);

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
                if (dialogue && dialogue !== "" && dialogue !== "N/A")
                    generatedDialogues.push(dialogue);
            }
            if (prependAiDialogue) {
                const prompt = prependAiDialogue?.prompt;
                const prependAiPrompt = `${mainPrompt}
              
              Generate a response to the user that will be pre-pended to the verbatim sentence below based on the attached prompt.
              
              Dialogue to Prepend To: ${generatedDialogues && generatedDialogues.length > 0 ? generatedDialogues[0] : 'No dialogue attached, simply create a pre-pended responses.'}
              
              Prompt: ${prompt}`;

                const messagesForPrepend = [...messages, { role: 'system', content: prependAiPrompt }];
                const generatedDialogue = await generateResponse(messagesForPrepend);
                generatedDialogues.push(generatedDialogue);
            }
            if (appendAiDialogue) {
                const prompt = appendAiDialogue?.prompt;
                const appendAiPrompt = `${mainPrompt}
              
              Generate a response to the user that will be appended to the verbatim sentence below based on the attached prompt.
              
              Dialogue to Append To: ${generatedDialogues && generatedDialogues.length > 0 ? generatedDialogues[0] : 'No dialogue attached, simply create an appended responses.'}  

              Prompt: ${prompt}`;

                const messagesForAppend = [...messages, { role: 'system', content: appendAiPrompt }];
                const generatedDialogue = await generateResponse(messagesForAppend);
                generatedDialogues.push(generatedDialogue);
            }
            characterDialogue = generatedDialogues.join(" ");
        }
        else {
            if (dialogue && dialogue !== "" && dialogue !== "N/A")
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
            responseData.additionalMedia = node.additionalMedia
        }

        if (node.audioBase64 && node.words && node.wtimes && node.wdurations) {
            console.log("Pre");
            responseData.audioBase64 = node.audioBase64;
            responseData.words = node.words;
            responseData.wtimes = node.wtimes;
            responseData.wdurations = node.wdurations;
        }

        return responseData;
    } catch (err) {
        console.error("Error in Scripted Response: ", err);
    }
}


// ===================
// initSession Definition
// ===================
// We use an express-session to keep track of variables along the way. It's highly, highly recommend to use a "session database" to store session variables in a table, avoiding memory leaks.
async function initSession(req) {
    if (!req.session.params)
        req.session.params = {};
    if (!req.session.params.messages) {
        req.session.params.messages = []

        var systemMessage = (systemPrompt && (systemPrompt !== "" || systemPrompt !== "N/A")) ? systemPrompt : "You are a virtual assistant who's goal is to help answer questions succinctly. Address the incoming user messages accurately and succinctly.";

        var systemObject = {
            role: "system",
            content: systemMessage
        }
        req.session.params.messages.push(systemObject);
    }
}


module.exports = router;