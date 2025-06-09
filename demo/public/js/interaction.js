import { characterAudio, characterAudioQueue, characterTextQueue, characterText } from './character.js';

var characterName = '';
var researcherEmail = '';
var voiceType = '';
var templateType = '';
var ttsEndpoint = '';
var verbalBackchannelsEnabled = false;

function normalizeUrl(url) {
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) {
        return `https://${url}`;
    }
    return url;
}

document.addEventListener('DOMContentLoaded', (event) => {
    const scenario = window.__SCENARIO__;
    characterName = scenario?.characterAvatar?.name || "Assistant";
    voiceType = scenario?.characterVoiceType;
    researcherEmail = scenario?.researcherEmail;
    templateType = scenario?.templateType;
    ttsEndpoint = scenario?.ttsEndpoint;
    verbalBackchannelsEnabled = scenario?.verbalBackchannelsEnabled;
    console.log(scenario);
    showLoading();

    if (templateType === "panel-view") {
        console.log("Here!");
        document.getElementById("history").addEventListener('click', () => {
            document.getElementById("chat-history").style.display = 'flex'
            let chatContainer = document.getElementById("chat-history")
            chatContainer.scrollTop = chatContainer.scrollHeight
            document.getElementById("chat-container-bg").style.display = 'flex'
        });

        document.getElementById("close-chat-history-icon").addEventListener('click', () => {
            document.getElementById("chat-history").style.display = 'none'
            document.getElementById("chat-container-bg").style.display = 'none'
        });
    }
});

function showLoading() {
    document.getElementById('loading-animation').style.display = "block";
    CSS.registerProperty({
        name: "--p",
        syntax: "<integer>",
        initialValue: 0,
        inherits: true,
    });

    const animatedElement = document.getElementById("loader-animation");

    animatedElement.onanimationend = () => {
        document.getElementById('loading-screen').classList.add("out")
        handleUserInput("START_FLAG", { userInput: "START_FLAG" });
    };
}

function createExpandButton() {
    const expandBtn = document.createElement('button');
    expandBtn.id = "fullscreenBtn"
    const expandIcon = document.createElement('i')
    expandIcon.className = "fa-solid fa-up-right-and-down-left-from-center"
    expandBtn.appendChild(expandIcon);
    const expandText = document.createElement('p');
    expandText.innerHTML = "Full Screen"
    expandBtn.appendChild(expandText);
    return expandBtn;
}

function appendMessage(message, speaker, nextNode = null, textInput = false, buttonInput = false, additionalMedia = null, useTypeWriter = true) {
    console.log("In appendMessage");
    const labelText = document.createElement('div');
    const messageText = document.createElement('div');
    const messageItem = document.createElement('div');
    labelText.className = "label-text";
    document.getElementById("input-area").style.visibility = "hidden"
    document.getElementById("options-area").style.visibility = "hidden"
    document.getElementById("media-container").innerHTML = ""
    document.getElementById("media-container").style.visibility = "hidden"

    if (templateType === "chatlog-view") {
        // console.log("IN APPEND MESSAGE", buttonInput)
        const chatBox = document.getElementById("chat-container")
        speaker === 'user' ? labelText.innerText = `You` : labelText.innerText = characterName;
        speaker === 'user' ? messageText.className = "user-chatbot-message" : messageText.className = "agent-chatbot-message"

        if (speaker === 'user') {
            console.log("in first?");
            if (message === 'text') {
                message = document.getElementById('user-input').value;
                let messageBody = { userInput: message }
                handleUserInput(nextNode, messageBody)
            }
            messageText.innerHTML = `${message}`;
            messageItem.className = "message-item"
            messageItem.appendChild(labelText);
            messageItem.appendChild(messageText);
            chatBox.appendChild(messageItem);
        } else {
            console.log("in second?");
            removeLoadingDots()
            if (message) {
                messageItem.className = "message-item"
                messageItem.appendChild(labelText);
                messageItem.appendChild(messageText);
                chatBox.appendChild(messageItem)
                displaySubtitles(message, messageText, textInput, buttonInput, useTypeWriter)
            }
            else {
                console.log("in third");
                if (textInput === true) {
                    document.getElementById('input-area').style.visibility = 'visible'
                }
                if (buttonInput === true) {
                    document.getElementById("options-area").style.visibility = 'visible'
                }
            }

        }
        if (speaker === 'user') {
            document.getElementById('user-input').value = '';
            appendLoadingDots();
        }

        chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
    }
    else if (templateType === "panel-view") {
        console.log("in panel view");
        const labelTextHistory = document.createElement('div');
        labelTextHistory.className = "label-text";
        const messageTextHistory = document.createElement('div');
        const messageItemHistory = document.createElement('div');
        var captionArea = document.getElementById("chat-container")
        captionArea.innerHTML = ""
        if (speaker !== 'user' && message) {
            console.log("in first?");
            labelText.innerText = characterName;
            labelTextHistory.innerText = characterName;
            console.log(labelTextHistory)
            messageText.className = "alex-chatbot-message"
            messageItem.className = "message-item"
            messageItem.appendChild(labelText);
            messageItem.appendChild(messageText);
            captionArea.appendChild(messageItem);

            messageTextHistory.className = "history-chatbot-message"
            messageItemHistory.className = "message-item"
            messageTextHistory.innerText = message
            messageItemHistory.appendChild(labelTextHistory);
            messageItemHistory.appendChild(messageTextHistory);
            document.getElementById("chat-history").appendChild(messageItemHistory)
            displaySubtitles(message, messageText, textInput, buttonInput)

        } else if (speaker === 'user') {
            console.log("in second?");

            if (message === 'text') {
                message = document.getElementById('user-input').value;
                let messageBody = { userInput: message }
                handleUserInput(nextNode, messageBody)
            }
            if (message !== "Start Conversation") {
                labelTextHistory.innerText = "You";
                messageItemHistory.appendChild(labelTextHistory);
                messageTextHistory.className = "history-user-chatbot-message"
                messageTextHistory.innerHTML = `${message}`;
                messageItemHistory.className = "message-item"
                messageItemHistory.appendChild(labelText);
                messageItemHistory.appendChild(messageTextHistory);
                document.getElementById("chat-history").appendChild(messageItemHistory)
            }
            document.getElementById('user-input').value = '';
        }
        else {
            console.log("in third");
            if (textInput === true) {
                document.getElementById('input-area').style.display = 'flex'
                document.getElementById('input-area').style.visibility = 'visible'

            }
            if (buttonInput === true) {
                document.getElementById("options-area").style.display = 'flex'
                document.getElementById("options-area").style.visibility = 'visible'

            }
        }

    }
    if (additionalMedia) {
        // console.log(additionalMedia)
        const mediaBox = document.getElementById("media-container")
        if (additionalMedia.mediaType === "PDF") {
            const iframe = document.createElement('iframe');
            // 2. Set the attributes
            iframe.src = additionalMedia.link;
            iframe.width = "95%";
            iframe.height = "100%";
            mediaBox.appendChild(iframe);
            var expandBtn = createExpandButton();
            mediaBox.appendChild(expandBtn);
            expandBtn.addEventListener('click', () => {
                console.log("CLICKED LINK")
                var modal = document.getElementById("modal")
                const iframe2 = document.createElement('iframe');
                // 2. Set the attributes
                iframe2.src = additionalMedia.link;
                iframe2.width = "95%";
                iframe2.height = "100%";
                document.getElementById("modal-media").appendChild(iframe2);
                modal.style.visibility = "visible"
                modal.style.opacity = "100"
                document.getElementById("modal-close").addEventListener('click', () => { modal.style.visibility = "hidden"; modal.style.opacity = "0"; document.getElementById("modal-media").innerHTML = "" })
            });
        } else if (additionalMedia.mediaType === "Image") {
            const image = document.createElement('img');
            image.src = additionalMedia.link
            image.style.maxHeight = "400px";
            mediaBox.appendChild(image);
            var expandBtn = createExpandButton();
            mediaBox.appendChild(expandBtn);
            expandBtn.addEventListener('click', () => {
                var modal = document.getElementById("modal")
                const image2 = document.createElement('img');
                image2.src = additionalMedia.link
                image2.style.width = "95%";
                document.getElementById("modal-media").appendChild(image2);
                modal.style.visibility = "visible"
                modal.style.opacity = "100"
                document.getElementById("modal-close").addEventListener('click', () => { modal.style.visibility = "hidden"; modal.style.opacity = "0", document.getElementById("modal-media").innerHTML = "" })
            });
        } else if (additionalMedia.mediaType === "Link") {
            const iframe = document.createElement('iframe');
            iframe.id = "myIframe"
            // 2. Set the attributes
            iframe.src = additionalMedia.link;
            iframe.width = "95%";
            iframe.height = "100%";
            mediaBox.appendChild(iframe);
            var expandBtn = createExpandButton();
            mediaBox.appendChild(expandBtn);
            expandBtn.addEventListener('click', () => {
                var modal = document.getElementById("modal")
                const iframe2 = document.createElement('iframe');
                // 2. Set the attributes
                iframe2.src = additionalMedia.link;
                iframe2.width = "95%";
                iframe2.height = "100%";
                document.getElementById("modal-media").appendChild(iframe2);
                modal.style.visibility = "visible"
                modal.style.opacity = "100"
                document.getElementById("modal-close").addEventListener('click', () => { modal.style.visibility = "hidden"; modal.style.opacity = "0", document.getElementById("modal-media").innerHTML = "" })
            });
        }
        mediaBox.style.visibility = "visible"
    }

}

function appendLoadingDots() {
    const chatBox = document.getElementById("chat-container")

    const ellipse = document.createElement('div');
    ellipse.className = "lds-ellipsis";
    ellipse.setAttribute('id', "lds-ellipsis")


    const l1 = document.createElement('div');
    const l2 = document.createElement('div');
    const l3 = document.createElement('div');

    ellipse.appendChild(l1)
    ellipse.appendChild(l2)
    ellipse.appendChild(l3)

    chatBox.appendChild(ellipse);
}

function removeLoadingDots() {
    document.getElementById("lds-ellipsis")?.remove();
}

async function handleUserInput(nodeName, body) {
    body.nodeName = nodeName;

    if (verbalBackchannelsEnabled && nodeName !== "START_FLAG" && nodeName !== "END_FLAG") {
        await handleBackchannel();
    }

    const dialogueFetch = fetch(`/Interaction/Dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    // console.log("GOT RESPONSE FROM BACKEND")
    const response = await dialogueFetch;
    if (!response.ok) {
        console.error('Failed to fetch response:', response.statusText);
        return;
    }

    const data = await response.json();
    console.log(data);
    // Small wait before character speaks, for loading dots to show properly
    setTimeout(async function () {
        if (data.dialogue && data.dialogue !== "") {
            // Static Audios
            if (data.audioBase64 && data.words && data.wtimes && data.wdurations) {
                const audioData = {
                    audioBase64: data.audioBase64,
                    words: data.words,
                    wtimes: data.wtimes,
                    wdurations: data.wdurations,
                }
                const talkingHeadAudio = await parseAudio(audioData);
                if (verbalBackchannelsEnabled && nodeName !== "START_FLAG" && nodeName !== "END_FLAG")
                    characterAudioQueue(talkingHeadAudio);
                else
                    characterAudio(talkingHeadAudio)
            }
            // ElevenLabs Audio
            else if (voiceType === "elevenLabs") {
                const audioBody = { text: data.dialogue };
                const audioResponse = await fetch(ttsEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(audioBody),
                });
                if (audioResponse.ok) {
                    console.log("trying to character audio");

                    const audioData = await audioResponse.json(); // gives ENTIRE audio at once
                    // console.log(audioData);
                    const talkingHeadAudio = await parseAudio(audioData);
                    console.log("talking Head Audio!");
                    // console.log(JSON.stringify(talkingHeadAudio));
                    if (verbalBackchannelsEnabled && nodeName !== "START_FLAG" && nodeName !== "END_FLAG")
                        characterAudioQueue(talkingHeadAudio);
                    else
                        characterAudio(talkingHeadAudio)
                }
            }
            // Google Audio
            else {
                if (verbalBackchannelsEnabled && nodeName !== "START_FLAG" && nodeName !== "END_FLAG")
                    characterTextQueue(data.dialogue);
                else
                    characterText(data.dialogue);
            }

        }
        appendMessage(data.dialogue, characterName, null, data.input.hasOwnProperty("text"), data.input.hasOwnProperty("button"), data.additionalMedia)
    }, 500);


    if (data.input.text) {
        document.getElementById("send-btn").onclick = function () {
            document.getElementById("options-area").innerHTML = ''
            appendMessage("text", "user", data.input.text.nextNode, false, false)
        }
    }

    if (data.input.button) {
        console.log("In buttons", data.input.button);
        displayOptions(data.input.button.options, data.nodeName, data.input.button.selectMultiple)
    }

}

function displayOptions(options, nodeName, selectMultiple = false) {
    const selectedOptions = [];
    const optionsArea = document.getElementById("options-area")
    options.forEach(option => {
        const button = document.createElement('button');
        var unselectedIcon = document.createElement('i')
        if (selectMultiple) {
            console.log("SELECT MULTIPLE, ADD LIL CIRCLE")
            unselectedIcon.className = "fa-regular fa-circle"
            button.appendChild(unselectedIcon);
        }
        var buttonText = document.createElement("p")
        buttonText.innerText = option.label
        button.appendChild(buttonText);
        button.classList.add("option-btn")
        if (selectMultiple) {
            button.classList.add("unselected")
        }
        button.addEventListener('click', () => {
            if (selectMultiple) {
                const index = selectedOptions.indexOf(option.label);
                if (index > -1) {
                    // Already selected, deselect
                    selectedOptions.splice(index, 1);
                    unselectedIcon.className = "fa-regular fa-circle"
                    button.classList.add("unselected");
                    button.classList.remove("selected");
                } else {
                    // Add to selection
                    selectedOptions.push(option.label);
                    unselectedIcon.className = "fa-solid fa-circle-check"
                    button.classList.add("selected");
                    button.classList.remove("unselected");
                }
                console.log("Selected Options:", selectedOptions);
            } else {
                if (nodeName === 'END_FLAG') {
                    if (option.surveyLink) {
                        const surveyLink = normalizeUrl(option.surveyLink);
                        window.open(surveyLink, '_blank')
                    } else {
                        alert(`Seems like there's no survey here. If you think there's supposed to be one, contact your researcher: ${researcherEmail}`)
                    }

                }
                else {
                    optionsArea.innerHTML = ''
                    appendMessage(option.label, 'user', null, false, false)
                    let messageBody = { userInput: option.label }
                    handleUserInput(option.nextNode, messageBody)
                }
            }

        });
        optionsArea.appendChild(button);
    });
    if (selectMultiple) {
        const submitBtn = document.createElement('button');
        submitBtn.textContent = "Submit";
        submitBtn.classList.add("submit-btn");
        submitBtn.addEventListener('click', () => {
            if (selectedOptions.length > 0) {
                appendMessage(selectedOptions.join(', '), 'user', null, false, false);
                let messageBody = { userInput: selectedOptions };
                handleUserInput(options[0].nextNode, messageBody); // Adjust logic if needed
                optionsArea.innerHTML = '';
            } else {
                alert("Please select at least one option.");
            }
        });
        var submitRow = document.createElement("div")
        submitRow.classList.add("submit-row")
        submitRow.appendChild(submitBtn)
        optionsArea.appendChild(submitRow);
    }
}
function displaySubtitles(dialogue, divItem, textInput, buttonInput, useTypeWriter = true) {
    const dialogueSection = divItem;
    const chatBox = document.getElementById("chat-container")

    // Start with the current content to avoid overwriting
    let existingText = dialogueSection.innerText.trim();
    let textToAdd = dialogue; // Dialogue to type
    let typewriterRunning = true;
    let i = 0; // Character index

    // Typewriter effect
    if (useTypeWriter) {
        function typeWriter() {
            if (!typewriterRunning) {
                // If the effect is canceled, instantly show remaining text
                cancelTypewriterEffect(dialogueSection, dialogue, sources);
                return;
            }
            if (i < textToAdd.length) {
                // Append each character
                if (i === 0 && existingText.length > 0) {
                    dialogueSection.innerHTML += ' '; // Add a space before new text
                }
                dialogueSection.innerHTML += textToAdd[i]; // Append character
                i++;
                setTimeout(typeWriter, 30); // Adjust speed (20ms per character)
            } else {
                typewriterRunning = false; // Reset the flag when done
                if (textInput === true) {
                    document.getElementById("input-area").style.display = 'flex'

                    document.getElementById('input-area').style.visibility = 'visible'
                }
                if (buttonInput === true) {
                    document.getElementById("options-area").style.display = 'flex'
                    document.getElementById("options-area").style.visibility = 'visible'
                }
            }
            if (templateType !== "panel-view") {
                chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
            }
        }

        typeWriter(); // Start typing animation
    }
    else {
        dialogueSection.innerHTML = textToAdd
    }

}

function cancelTypewriterEffect(dialogueSection, wholeDialogue, sources) {
    typewriterRunning = false;
    dialogueSection.innerHTML = wholeDialogue; // Instantly display the complete dialogue
    if (sources !== null) {
        for (var j = 0; j < sources.length; j++) {
            const link = document.createElement('p');
            link.className = "source-link";
            link.textContent = `[ Source: ${j + 1} ]`;

            var pdfModal = document.getElementById('pdfModal');
            var pdfViewer = document.getElementById('pdfViewer');
            document.getElementById('resource-item').innerText = sources[j].slice(0, -4);

            link.onclick = (function (index) {
                return function () {
                    pdfModal.style.display = 'flex';
                    pdfViewer.src = '../sources/' + sources[index];
                };
            })(j);

            dialogueSection.appendChild(document.createTextNode(' ')); // Add a space
            dialogueSection.appendChild(link);
        }

        // Move this outside the loop
        window.onclick = function (event) {
            if (event.target == pdfModal) {
                pdfModal.style.display = 'none';
            }
        };

    }
}

async function parseAudio(audio) {
    console.log("parseAudio called with audio:", { audio });

    try {
        // Get the Base64 audio string
        const base64Audio = audio.audioBase64;
        console.log("Base 64 audio is: ", base64Audio)

        // Decode the Base64 audio string into an ArrayBuffer
        const arrayBuffer = await fetch(`data:audio/wav;base64,${base64Audio}`)
            .then(response => response.arrayBuffer());
        console.log("Audio decoded into ArrayBuffer.");

        // Create an AudioContext
        const audioContext = new AudioContext();
        console.log("AudioContext created.");

        // Decode the ArrayBuffer into an AudioBuffer
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log("AudioBuffer decoded:", audioBuffer);

        // Create a new audio object with the decoded AudioBuffer
        const audioWithWav = {
            ...audio,
            audio: audioBuffer,
            sampleRate: audioBuffer.sampleRate,
        };

        return audioWithWav;
    } catch (error) {
        console.error("Error decoding audio data:", error);
        throw error;
    }
}


async function handleBackchannel() {
    try {
        const res = await fetch('/Interaction/VerbalBackchannel');
        if (!res.ok) throw new Error('Failed to fetch backchannel audio');

        const audioData = await res.json();
        const talkingHeadAudio = await parseAudio(audioData);
        await characterAudio(talkingHeadAudio); // must be awaitable (as discussed)
        await appendMessage(audioData.dialogue, "Agent", null, null, null, null, false);
    } catch (err) {
        console.error("Backchannel error:", err);
    }
}