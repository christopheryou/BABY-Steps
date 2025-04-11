const path = require('path');
const fs = require('fs');

const { scenario } = require('../scenario.js');
const jsonDir = path.resolve(__dirname, './json')
const { v4: uuidv4 } = require('uuid');


const backchannels = [
    "Let me generate a meaningful response based on what you’ve said so far.",
    "You’re doing great. I’m crafting the next part of our conversation.",
    "Thanks for being open. I’m working on generating something thoughtful based on what you’ve shared.",
    "I’m reflecting on everything so far to create the next step in our dialogue.",
    "I’m organizing my thoughts to ensure a clear and helpful response for you.",
];



// Route to generate audio for all dialogue nodes and save as JSON
// This is for the pre-generated audios in the ConversationScript.json and creates "CompleteConversationScript.json"
async function generateStaticAudiosInScriptedConversation() {
    const audioMetadata = [];
    const inputFile = path.join(jsonDir, '/ConversationScript.json');
    const outputFile = path.join(jsonDir, '/CompleteConversationScript.json');

    // Load the original JSON data
    let dialogueNodes;
    try {
        dialogueNodes = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    } catch (error) {
        console.error("Error reading input JSON file:", error);
        return res.status(500).json({ error: 'Failed to read input JSON file.' });
    }

    // Process each node
    for (const node of dialogueNodes) {
        try {
            let audioDataF = null;
            let audioDataM = null;

            // Process nodes with dialogue
            if (node.dialogue && (node.response == null || node.response.alterDialogue === false)) {
                const textToConvert = node.dialogue;

                // Generate audio for Female voice
                audioDataF = await generateAudio(textToConvert, 'shimmer');

                // Generate audio for Male voice
                audioDataM = await generateAudio(textToConvert, 'echo');
            }

            // Add audioM and audioF fields to the node
            const updatedNode = {
                ...node,
                audioM: audioDataM,
                audioF: audioDataF,
            };

            audioMetadata.push(updatedNode);
        } catch (error) {
            console.error(`Error processing node ${node.nodeId}:`, error);
        }
    }

    // Save the updated JSON
    try {
        await fs.promises.writeFile(outputFile, JSON.stringify(audioMetadata, null, 2));
        console.log(`Updated JSON with audio metadata saved to ${outputFile}`);
    } catch (error) {
        console.error("Error writing updated JSON to file:", error);
        return res.status(500).json({ error: 'Failed to write updated JSON file.' });
    }

    res.json({ message: 'Audio generation complete', outputFile });
}

async function generateVerbalBackchannels() {
    const audioMetadata = [];
    const outputFile = path.join(jsonDir, '/VerbalBackchannels.json');

    for (const backchannel of backchannels) {
        try {
            let audioDataF = null;
            let audioDataM = null;

            // Process nodes with dialogue
            const textToConvert = backchannel;

            // Generate audio for Female voice
            audioDataF = await generateAudio(textToConvert, 'shimmer');

            // Generate audio for Male voice
            audioDataM = await generateAudio(textToConvert, 'echo');

            const metadata = {
                dialogue: backchannel,
                audioF: audioDataF,
                audioM: audioDataM
            };

            audioMetadata.push(metadata);
        } catch (error) {
            console.error(`Error creating backchannels:`, error);
        }
    }

    // Save the updated JSON
    try {
        await fs.promises.writeFile(outputFile, JSON.stringify(audioMetadata, null, 2));
        console.log(`Updated JSON with audio metadata saved to ${outputFile}`);
    } catch (error) {
        console.error("Error writing updated JSON to file:", error);
        return res.status(500).json({ error: 'Failed to write updated JSON file.' });
    }

    res.json({ message: 'Verbal Backchannels generation completed', outputFile });
}

// Function to generate audio and transcriptions
async function generateAudio(text, voice) {
    try {
        // Generate speech
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice,
            input: text,
            response_format: "wav",
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        const uniqueFilename = `speech_${uuidv4()}.wav`;
        const speechFile = path.resolve(__dirname, `./audio/${uniqueFilename}`);

        await fs.promises.writeFile(speechFile, buffer);

        // Adjust audio speed
        const spedUpFilename = `spedup_${uniqueFilename}`;
        const spedUpFilePath = path.resolve(__dirname, `./audio/${spedUpFilename}`);

        await new Promise((resolve, reject) => {
            ffmpeg(speechFile)
                .audioFilters('atempo=1.1') // Speed up the audio
                .save(spedUpFilePath)
                .on('end', resolve)
                .on('error', reject);
        });

        // Convert to Base64
        const spedUpBuffer = await fs.promises.readFile(spedUpFilePath);
        const audioBase64 = spedUpBuffer.toString('base64');

        // Transcribe audio
        const transcriptionResponse = await openai.audio.transcriptions.create({
            file: fs.createReadStream(spedUpFilePath),
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["word", "segment"],
        });

        if (transcriptionResponse && transcriptionResponse.words) {
            return {
                audioBase64: audioBase64,
                words: transcriptionResponse.words.map(x => x.word),
                wtimes: transcriptionResponse.words.map(x => 1000 * x.start - 150),
                wdurations: transcriptionResponse.words.map(x => 1000 * (x.end - x.start)),
            };
        }

        return null;
    } catch (error) {
        console.error("Error generating audio:", error);
        return null;
    }
}

async function uploadKnowledgeBase(fileStream, vectorStoreId = null) {
    // console.log(fileStream, apiKey);
    try {
        console.log("Uploading a file..");
        const file = await openai.files.create({
            file: fileStream,
            purpose: "user_data",
        });

        console.log("Sucessfully uploaded file: ", file.id);
        let newVectorStoreId;
        if (vectorStoreId && vectorStoreId != "") {
            console.log("Using Vector Store Argument: ", vectorStoreId);
            newVectorStoreId = vectorStoreId;
        }
        else {
            console.log("Creating a Vector Store for file upload...")
            const vectorStore = await openai.vectorStores.create({
                name: "KnowledgeBase",
            })
            newVectorStoreId = vectorStore.id;
        };
        console.log("Uploading File to Vector Store...");
        const upload = await openai.vectorStores.files.create(
            newVectorStoreId,
            {
                file_id: file.id,
            }
        )
        console.log(`Successfully uploaded file ${file.id} to vector store ${newVectorStoreId}`);
        return { fileId: file.id, vectorStoreId: newVectorStoreId };
    }
    catch (err) {
        console.log(err);
    }

}

async function deleteFile(fileId) {
    try {
        console.log("Deleting file store: ", fileId);
        const file = await openai.files.del(fileId);
        console.log("Successfully deleted file store: ", fileId);
        return file.deleted;
    }
    catch (err) {
        console.log(err);
    }
}

async function deleteVectorStore(vectorStoreId) {
    try {
        console.log("Deleting vector store: ", vectorStoreId);

        const deletedVectorStore = await openai.vectorStores.del(
            vectorStoreId
          );
        console.log("Successfully deleted vector store: ", vectorStoreId);
        return deletedVectorStore.deleted;
    }
    catch (err) {
        console.log(err);
    }
}

function getRandomPlaceholder() {
    const randomIndex = Math.floor(Math.random() * placeholdersData.length);
    const selectedPlaceholder = placeholdersData[randomIndex];
    const audioObject = voiceGender === "male" ? nodeObject?.maleAudio : nodeObject?.femaleAudio;

    const placeholderResponse = {
        dialogue: selectedPlaceholder.dialogue,
        audio: audioObject,
        type: "PLACEHOLDER"
    };

    return placeholderResponse;
}


function generateOpenConversationScript(survey) {
    const jsonContent =  {
      START_FLAG: {
        input: {
          button: {
            options: [
              {
                label: "Start Conversation",
                nextNode: "MAIN_NODE"
              }
            ]
          }
        }
      },
      MAIN_NODE: {
        input: {
          text: {
            nextNode: "MAIN_NODE"
          },
          button: {
            options: [
              {
                label: "End Conversation",
                nextNode: "END_FLAG"
              }
            ]
          }
        }
      },
      END_FLAG: {
        input: {
          button: {
            options: [
              {
                label: "Complete Survey",
                surveyLink: survey || "N/A",
              }
            ]
          }
        }
      }
    };

    const filePath = path.join(jsonDir, 'OpenConversationScript.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(jsonContent, null, 2), 'utf-8');
    console.log(`✔️ JSON data written to: ${filePath}`);



  };
