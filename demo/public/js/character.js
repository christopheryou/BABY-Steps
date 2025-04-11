// Importing the TalkingHead module
import { TalkingHead } from 'talkinghead';

var head; // TalkingHead instance
var first = true;
// Load and show the avatar
document.addEventListener('DOMContentLoaded', async function (e) {
  const scenario = {
    researcherEmail: window.__SCENARIO__?.researcherEmail,
    characterPath: window.__SCENARIO__?.characterAvatar?.path,
    body: window.__SCENARIO__?.characterAvatar?.body,
    mood: window.__SCENARIO__?.characterAvatar?.mood,
    cameraView: window.__SCENARIO__?.characterAvatar?.cameraView,
    ttsEndpoint: window.__SCENARIO__?.ttsEndpoint,
    ttsVoice: window.__SCENARIO__?.ttsVoice
  };

  console.log(scenario);
  
  const email = scenario?.researcherEmail;
  const url = scenario?.characterPath;
  if (!url) {
    console.warn('⚠️ No character URL provided.');
    alert(`No avatar file found for this scenario. Please refresh the page and try again. If issues persist, contact your researcher: ${email}`);
    return;
  }
  const body = scenario?.body;
  const avatarMood = scenario?.mood;
  const cameraView = scenario?.cameraView;
  const ttsEndpoint = scenario?.ttsEndpoint || "";
  const ttsVoice = scenario?.ttsVoice;

  // steps = document.querySelectorAll('.step');

  // Instantiate the class
  // NOTE: Text-to-speech not initialized
  const nodeAvatar = document.getElementById('avatar');
  head = new TalkingHead(nodeAvatar, {
    ttsEndpoint: ttsEndpoint,
    ttsVoice: ttsVoice,
    lipsyncModules: ["en"], // language
    cameraY: 0,
    cameraView: cameraView, // full, mid, upper, head
    cameraDistance: 0, // negative is zoom in from base, postitive zoom out (in meters)
    cameraRotateEnable: false,
    cameraPanEnable: false,
    cameraZoomEnable: false,
  });

  // Load and show the avatar
  try {
    await head.showAvatar({
      url: url,
      body: body,
      avatarMood: avatarMood,
      lipsyncLang: 'en',
    }, (ev) => { });

  } catch (error) {
    console.log(error);
    alert(`Failed to load 3D avatar. Please refresh the page and try again. If issues persist, contact your researcher: ${email}`);

  }
});

export async function characterAudio(audio) {
  console.log("Character Audio: ", audio)
  try {
    // console.log("Checking speaking: ", head.isSpeaking, head.speechQueue);      
    if (first) {
      head.playGesture('👋');
      first = false;
    }
    head.replaceAndSpeakNewAudio(audio);

  } catch (error) {
    console.error('Error during speech processing:', error);
  }
}

// for streaming audio, waits for current audio to finish
export async function characterAudioQueue(audio) {
  try {
    // console.log("Checking speaking: ", head.isSpeaking, head.speechQueue);      
    // can have subtitles! and other stuff. hve to look more into if u want it
    head.speakAudio(audio, null, null);

  } catch (error) {
    console.error('Error during speech processing:', error);
  }
}

// for streaming audio, waits for current audio to finish
export async function stopSpeaking() {
  try {
    head.stopSpeaking();
  } catch (error) {
    console.error('Stopping speaking', error);
  }
}

export async function characterText(text) {
  try {
    if (first) {
      head.playGesture('👋');
      first = false;
    }
    head.replaceAndSpeakNewText(text);
  } catch (error) {
    console.error('Error during speech processing:', error);
  }
}