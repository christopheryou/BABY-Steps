const express = require('express');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Adjust path to root
// Used to generate responses
const OpenAI = require('openai')
const openai = new OpenAI({apiKey : process.env.OPENAI_API_KEY});

// Used to Speed Up Audio (if needed)
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg'); // Import ffmpeg for audio processing
const ffmpegPath = require('ffmpeg-static'); // Path to the static binary
ffmpeg.setFfmpegPath(ffmpegPath); // Set the path explicitly

const router = express.Router()
router.use(express.static(path.join(__dirname, 'public')));
const jsonDir = path.resolve(__dirname, './json')
const { v4: uuidv4 } = require('uuid');

// Path to Json Script
// Path to Placeholders Script if any
const scriptPath = path.join(jsonDir, '/CompleteConversationScript.json');
const placeholdersPath = path.join(jsonDir, '/Placeholders.json');

// Preload data at the beginning
let placeholdersData;
let scriptData;

try {
    scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
    console.log("Successfully preloaded script metadata.");
} catch (err) {
    console.error("Error reading or parsing audio", err);
    scriptData = []; // Fallback to empty data
}


try {
    placeholdersData = JSON.parse(fs.readFileSync(placeholdersPath, 'utf8'));
    console.log("Successfully preloaded placeholders data.");
} catch (err) {
    console.error("Error reading or parsing Placeholders.json:", err);
    placeholdersData = []; // Fallback to empty data
}


// The main function to handle user input.
router.post('/:nodeId', async (req, res, next) => {
    // console.log(req.session.params);
    if (!req.session.params)
        req.session.params = {};
    if (!req.session.params.messages) {
        req.session.params.messages = []
        var systemMessage = "You are a virtual chat assistant named Alex.";
        var systemObject = {
            role: "system",
            content: systemMessage
        }
        req.session.params.messages.push(systemObject);
    }

    const nodeId = parseInt(req.params.nodeId);
    const additionalData = req.body || {};
    const gender = "female";
    try {
        // Find node data in preloaded metadata
        const nodeData = scriptData.find(item => item.nodeId === nodeId);

        if (!nodeData) {
            console.error(`Node with ID ${nodeId} not found.`);
            return res.status(404).json({ error: `Node with ID ${nodeId} not found` });
        }

        // No ChatGPT Usage
        if (nodeData.dialogue && nodeData.response == null) {
            // console.log("Pre-recorded response detected.");
            const audio = nodeData.audioF;
            const responseData = {
                nodeId: nodeId,
                dialogue: nodeData.dialogue,
                audio: audio,
                input: nodeData.input || null,
                options: nodeData.options || [],
            };

            var systemResponse = {
                role: "assistant",
                content: nodeData.dialogue
            }
            req.session.params.messages.push(systemResponse);
            res.setHeader('Content-Type', 'application/json; type=prerecorded'); 
            
            return res.json(responseData);
        } 
        // ChatGPT Usage
        else {

            
            res.setHeader('Content-Type', 'application/json; charset=utf-8');

            // 67% chance to send a placeholder
            if (placeholdersData.length > 0) { // 40% probability
                const randomIndex = Math.floor(Math.random() * placeholdersData.length);
                const selectedPlaceholder = placeholdersData[randomIndex];
                const audio = gender == "male" ? selectedPlaceholder.audioM : selectedPlaceholder.audioF;

                const placeholderResponse = {
                    userId: req.session?.params?.id || null,
                    nodeId: nodeId,
                    dialogue: selectedPlaceholder.dialogue,
                    audio: audio,
                    type: "PLACEHOLDER",
                    input: null,
                    options: [],
                    url: null,
                    progressInterview: null
                };
                res.write(JSON.stringify(placeholderResponse) + '\n');
            }

            // Generate dialogue
            // Create the initial message with the system role and prompt
            var constructedPrompt = "";
            if (additionalData) {
                constructedPrompt += "USER SAID: " + additionalData.userInput;
            }
            if (nodeData.response && nodeData.response.prompt) {
                constructedPrompt += "\n" + nodeData.response.prompt;
            }
            if (nodeData.response && nodeData.response.alterDialogue) {
                constructedPrompt += "\n The next question to ask the user is as follows, please only provide only minor modifications (as needed) and ask these question(s): " + nodeData.dialogue;
            }

            if (nodeData.response && nodeData.response.randomizedLength) {
                var numWords = getRandomMaxWords();
                constructedPrompt += "\nKeep your response to a maximum of " + numWords + " words.";
            }
            if (nodeData.response && nodeData.response.fixedLength) {
                constructedPrompt += "\nKeep your response to a strict maximum of " + nodeData.fixedLength;
            }

            const userResponse = {
                role: "user",
                content: constructedPrompt
            }
            req.session.params.messages.push(userResponse);

            const generatedDialogue = await respondWithChatGPT(req.session.params.messages);
            var responseData = {
                userId: req.session?.params?.id || null,
                nodeId: nodeId,
                dialogue: generatedDialogue,
                audio: null,
                input: nodeData.input || null,
                options: nodeData.options || [],
                url: nodeData.url || null,
                progressInterview: nodeData.progressInterview || null,
                type: "NEW AUDIO",
                wholeDialogue: generatedDialogue
            };

            var wholeDialogue = generatedDialogue;

            if (nodeData.response != null && nodeData.response.alterDialogue === false) {
                responseData.wholeDialogue = responseData.wholeDialogue + " " + nodeData.dialogue;
                wholeDialogue = responseData.wholeDialogue;
            }

            var systemObject = {
                role: "assistant",
                content: responseData.wholeDialogue
            }
            req.session.params.messages.push(systemObject);


            // Audio Chunk Streaming
            const sentences = splitTextIntoSentences(generatedDialogue);
            // console.log("Split dialogue into sentences:", sentences);

            // Process first chunk immediately
            const firstChunk = await processSentence(sentences[0], responseData, req, true);
            // console.log("Sending first sentence:", firstChunk.dialogue);
            res.write(JSON.stringify(firstChunk) + '\n');

            // Process remaining chunks concurrently
            const remainingChunksPromises = sentences.slice(1).map((sentence, index) =>
                processSentence(sentence, responseData, req, false)
            );
            try {
                const remainingChunks = await Promise.all(remainingChunksPromises);

                // Stream remaining chunks as they finish
                remainingChunks.forEach(chunk => {
                    // console.log("Sending remaining sentence:", chunk.dialogue);
                    res.write(JSON.stringify(chunk) + '\n');
                });

                // Only execute this AFTER all remaining chunks are done
                if (nodeData.response != null && nodeData.response.alterDialogue === false) {
                    // console.log("Sending pre-generated sentence:", nodeData.dialogue);
                    const audio = gender == "male" ? nodeData.audioM : nodeData.audioF;
                    responseData.dialogue = nodeData.dialogue;
                    responseData.audio = audio;
                    responseData.type = "END CHUNK";
                    res.write(JSON.stringify(responseData) + '\n');
                }

                // console.log("Finished processing all sentences. Ending response stream.");
                res.end();
            } catch (err) {
                console.error('Error processing remaining chunks:', err);
                res.end();
            }
        }
    } catch (err) {
        console.error('Error during request processing:', err);
        return res.status(500).json({ error: 'Failed to process request' });
    }
});

function getRandomMaxWords() {
    // List of possible maximum word counts
    const maxWordOptions = [20, 35, 50]; // Short, Medium, Long

    // Randomly pick one
    const randomMax = maxWordOptions[Math.floor(Math.random() * maxWordOptions.length)];
    // console.log(randomMax);
    return randomMax;
}

// Helper function to process a single sentence
async function processSentence(sentence, nodeData, isFirstChunk) {
    const chunkType = isFirstChunk ? "NEW AUDIO" : "CHUNK";
    const createdFiles = [];
    const tempDir = '/audio'; // Directory for temporary files
    const gender = 'female';

    try {
        // Ensure /tmp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log(`Created directory: ${tempDir}`);
        }
        const voice = gender === "male" ? 'echo' : 'shimmer';

        // Generate audio
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice,
            input: sentence,
            response_format: "wav",
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        const uniqueFilename = `speech_${uuidv4()}.wav`;
        const speechFile = path.join(tempDir, uniqueFilename);
        await fs.promises.writeFile(speechFile, buffer);
        createdFiles.push(speechFile);

        // Speed up audio
        const spedUpFilename = `spedup_${uniqueFilename}`;
        const spedUpFilePath = path.join(tempDir, spedUpFilename);
        await new Promise((resolve, reject) => {
            ffmpeg(speechFile)
                .audioFilters('atempo=1.1')
                .save(spedUpFilePath)
                .on('end', resolve)
                .on('error', reject);
        });
        createdFiles.push(spedUpFilePath);

        // Convert to Base64
        const spedUpBuffer = await fs.promises.readFile(spedUpFilePath);
        const audioBase64 = spedUpBuffer.toString('base64');

        // Transcription
        const transcriptionResponse = await openai.audio.transcriptions.create({
            file: fs.createReadStream(spedUpFilePath),
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["word", "segment"],
        });

        const sentenceAudio = transcriptionResponse?.words
            ? {
                audioBase64,
                words: transcriptionResponse.words.map(x => x.word),
                wtimes: transcriptionResponse.words.map(x => 1000 * x.start - 150),
                wdurations: transcriptionResponse.words.map(x => 1000 * (x.end - x.start)),
            }
            : { audioBase64 };

        return {
            nodeId: nodeData.nodeId,
            dialogue: sentence,
            audio: sentenceAudio,
            input: nodeData.input || null,
            options: nodeData.options || [],
            type: chunkType,
            wholeDialogue: nodeData.wholeDialogue
        };
    } catch (error) {
        console.error("Error processing sentence:", error);
        return { error: `Failed to process sentence: ${sentence}` };
    } finally {
        // Cleanup: Delete all created audio files
        for (const filePath of createdFiles) {
            try {
                await fs.promises.unlink(filePath);
                // console.log(`Deleted file: ${filePath}`);
            } catch (cleanupError) {
                console.error(`Failed to delete file: ${filePath}`, cleanupError);
            }
        }
    }
}

async function respondWithChatGPT(messages) {
    try {
        const completion = await openai.chat.completions.create({
            messages: messages,
            model: "gpt-4o-mini",
        });

        // Return only the text content
        return completion.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error generating dialogue with ChatGPT:', error);
        throw new Error('Failed to generate dialogue.');
    }
}

function splitTextIntoSentences(text) {
    // Modern approach using Intl.Segmenter
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
        return Array.from(segmenter.segment(text), segment => segment.segment);
    }

    // Fallback for environments without Intl.Segmenter
    return text.match(/[^.!?]+[.!?]+/g) || [text];
}

module.exports = router;