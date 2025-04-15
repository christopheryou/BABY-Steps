const path = require('path');
const fs = require('fs');
const { ElevenLabsClient } = require('elevenlabs');
const { scenario } = require('../scenario.js');
const jsonDir = path.resolve(__dirname, '../json')
const { getAudioDurationInSeconds } = require('get-audio-duration');

const audioType = scenario?.characterVoice?.type || "N/A";
const audioApiKey = scenario?.characterVoice?.apiKey || "N/A";
const audioModel = scenario?.characterVoice?.model || "N/A";

const verbalBackchannels = [
  "Let me generate a meaningful response based on what you’ve said so far.",
  "You’re doing great. I’m crafting the next part of our conversation.",
  "Thanks for being open. I’m working on generating something thoughtful based on what you’ve shared.",
  "I’m reflecting on everything so far to create the next step in our dialogue.",
  "I’m organizing my thoughts to ensure a clear and helpful response for you.",
];



async function generateElevenLabsTTS(text) {
  const client = new ElevenLabsClient({ apiKey: audioApiKey });
  
  const response = await client.textToSpeech.convertWithTimestamps(audioModel, {
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

async function generateGoogleTTS(ssml, voice = null, pitch = null, audioEncoding = "OGG_OPUS") {
  console.log("Generating Google TTS.");
  if (!voice) {
    voice = audioModel;
  }
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
              "name": voice
          },
          "audioConfig": {
              "audioEncoding": audioEncoding,
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

function getRandomVerbalBackchannel(verbalBackchannel) {
  const randomIndex = Math.floor(Math.random() * verbalBackchannel.length);
  const selectedVerbalBackchannel = verbalBackchannel[randomIndex];

  const verbalBackchannelResponse = {
    dialogue: selectedVerbalBackchannel.dialogue,
    audioBase64: selectedVerbalBackchannel.audioBase64,
    words: selectedVerbalBackchannel.words,
    wtimes: selectedVerbalBackchannel.wtimes,
    wdurations: selectedVerbalBackchannel.wdurations,

  };

  return verbalBackchannelResponse;
}

// The five functions below are all helper functions to generate any "static" audios in your conversation script.
// You don't need these if your system is fully using LLMs, with no pre-scripted dialogue.
async function generateStaticAudiosInScriptedConversation(inputFilePathInJsonFolder = "ConversationScript.json", outputFilePathInJsonFolder = "ConversationScriptWithStaticAudios.json") {

  const inputFile = path.join(jsonDir, inputFilePathInJsonFolder);
  const outputFile = path.join(jsonDir, outputFilePathInJsonFolder);

  if (!audioModel || audioModel === "" || audioModel === "N/A") {
    console.log("Unknown audio model specified: ", audioModel);
    return;
  }
  if (!audioType || audioType === "" || audioType === "N/A") {
    console.log("Unknown audio model type specified: ", audioType);
    return;
  }
  if (!audioApiKey || audioApiKey === "" || audioApiKey === "N/A") {
    console.log("Unknown audio model api key specified: ", audioApiKey);
    return;
  }


  // Load the original JSON data
  let nodes;
  try {
    nodes = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  } catch (error) {
    console.error("Error reading input JSON file:", error);
    return ({ error: 'Failed to read input JSON file.' });
  }
  console.log(nodes);

  // Process each node
  for (const nodeKey in nodes) {
    const node = nodes[nodeKey];
    try {
      let audioBase64, words, wtimes, wdurations = null;

      // Process nodes with dialogue
      const dialogue = node?.response?.dialogue;
      const useAi = node?.response?.useAi;
      if (dialogue && dialogue !== "" && dialogue !== "N/A" && !useAi) {
        if (audioType == "google") {
          ({ audioBase64, words, wtimes, wdurations } = await pregenerateGoogleTTS(dialogue));
        }
        else if (audioType == "elevenLabs") {
          ({ audioBase64, words, wtimes, wdurations } = await generateElevenLabsTTS(dialogue, audioModel));
        }

      }

      // Add audioM and audioF fields to the node
      nodes[nodeKey] = {
        ...node,
        audioBase64,
        words,
        wtimes,
        wdurations,
      };

    } catch (error) {
      console.error(`Error processing node ${node.nodeId}:`, error);
    }
  }

  // Save the updated JSON
  try {
    await fs.promises.writeFile(outputFile, JSON.stringify(nodes, null, 2));
    console.log(`Updated JSON with audio metadata saved to ${outputFile}`);
  } catch (error) {
    console.error("Error writing updated JSON to file:", error);
    return ({ error: 'Failed to write updated JSON file.' });
  }

  return ({ message: 'Audio generation complete', outputFile });
}

async function generateVerbalBackchannels(outputFilePathInJsonFolder = "VerbalBackchannels.json") {
  const audioMetadata = [];
  const outputFile = path.join(jsonDir, outputFilePathInJsonFolder);

  if (!audioModel || audioModel === "" || audioModel === "N/A") {
    console.log("Unknown audio model specified: ", audioModel);
    return;
  }
  if (!audioType || audioType === "" || audioType === "N/A") {
    console.log("Unknown audio model type specified: ", audioType);
    return;
  }
  if (!audioApiKey || audioApiKey === "" || audioApiKey === "N/A") {
    console.log("Unknown audio model api key specified: ", audioApiKey);
    return;
  }

  for (const backchannel of verbalBackchannels) {
    try {
      let audioBase64, words, wtimes, wdurations = null;

      // Process nodes with dialogue
      const textToConvert = backchannel;

      if (audioType == "google") {
        ({ audioBase64, words, wtimes, wdurations } = await pregenerateGoogleTTS(textToConvert));
      }
      else if (audioType == "elevenLabs") {
        ({ audioBase64, words, wtimes, wdurations } = await generateElevenLabsTTS(textToConvert, audioModel));
      }
      else {
        // You'll likely want to transcribe the audio using the transcribeAudio() function if you're using a method that does not have TTS and Transcriptions in parallel.
      }

      const metadata = {
        dialogue: backchannel,
        audioBase64,
        words,
        wtimes,
        wdurations
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
    return ({ error: 'Failed to write updated JSON file.' });
  }

  return ({ message: 'Verbal Backchannels generation completed', outputFile });
}


function generateSSML(text) {
  text = text.trim().split(/\s+/).map((word, index) => ({
    mark: index,
    word: word
  }));
  console.log(text);
  let ssml = "<speak>";
  text.forEach((x, i) => {
    // Add mark
    if (i > 0) {
      ssml += " <mark name='" + x.mark + "'/>";
    }

    // Add word
    ssml += x.word.replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&apos;')
      .replace(/^\p{Dash_Punctuation}$/ug, '<break time="750ms"/>');

  });
  ssml += "</speak>";
  return { ssml, text };
}


function getTimestampsAndDurationsForGoogleTTS(audioDuration, words, timepoints) {

  const times = [0];
  let markIndex = 0;
  words.forEach((x, i) => {
    if (i > 0) {
      let ms = times[times.length - 1];
      if (timepoints[markIndex]) {
        ms = timepoints[markIndex].timeSeconds * 1000;
        if (timepoints[markIndex].markName === "" + x.mark) {
          markIndex++;
        }
      }
      times.push(ms);
    }
  });

  // Word-to-audio alignment
  const newTimepoints = [{ mark: 0, time: 0 }];
  times.forEach((x, i) => {
    if (i > 0) {
      let prevDuration = x - times[i - 1];
      if (prevDuration > 150) prevDuration - 150; // Trim out leading space
      newTimepoints[i - 1].duration = prevDuration;
      newTimepoints.push({ mark: i, time: x });
    }
  });
  let ttsTrimEnd = 400;
  let d = 1000 * audioDuration; // Duration in ms
  if (d > ttsTrimEnd) d = d - ttsTrimEnd; // Trim out silence at the end
  newTimepoints[newTimepoints.length - 1].duration = d - newTimepoints[newTimepoints.length - 1].time;

  return { times, newTimepoints };
}

async function pregenerateGoogleTTS(dialogue) {
  const { ssml, text } = generateSSML(dialogue);
  const output = await generateGoogleTTS(ssml, audioModel, null, "MP3");
  const buffer = Buffer.from(output.audioContent, 'base64');
  // Save the buffer as a file (e.g., audio.mp3)
  const filePath = path.join(__dirname, 'audio.mp3');
  fs.writeFileSync(filePath, buffer);

  // Get audio duration since Google TTS doesn't provide this.
  const duration = await getAudioDurationInSeconds(filePath);

  const { times, newTimepoints } = getTimestampsAndDurationsForGoogleTTS(duration, text, output.timepoints);

  const audioBase64 = output.audioContent;
  const words = text.map(item => item.word);
  const wtimes = times;
  const wdurations = newTimepoints.map(item => item.duration);
  return { audioBase64, words, wtimes, wdurations }
}


// Example Usage of Generating Static Audios in Scripted conversation:
//generateStaticAudiosInScriptedConversation("ConversationScriptWithMedia.json", "CompleteConversationScript2.json");

// Example Usage of Generating Verbal Backchannels based on the verbalBackchannels array
// generateVerbalBackchannels();


module.exports = {
  getRandomVerbalBackchannel,
  generateGoogleTTS,
  generateElevenLabsTTS
};