const path = require('path');
const fs = require('fs');
const { scenario } = require('../scenario');
const jsonDir = path.resolve(__dirname, '../json');

const conversationScriptPath = scenario?.conversationScript?.path || "N/A";
const verbalBackchannelsEnabled = scenario?.verbalBackchannels?.enabled;
const verbalBackchannelsPath = scenario?.verbalBackchannels?.path || "N/A";


function generateOpenConversationScript(survey, fileName = "OpenConversationScript.json") {
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

    const filePath = path.join(jsonDir, fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(jsonContent, null, 2), 'utf-8');
    console.log(`✔️ JSON data written to: ${filePath}`);
};


function initConversationScript() {
    if (!conversationScriptPath || (conversationScriptPath == "" || conversationScriptPath == "N/A")) {
        scriptData = []; // Fallback to empty data
        return scriptData;
    }
    try {
        let scriptData = JSON.parse(fs.readFileSync(conversationScriptPath, 'utf8'));
        console.log("Successfully preloaded conversation script at: ", conversationScriptPath);
        return scriptData;
    } catch (err) {
        console.error("Error reading or parsing CompleteConversationScript.json", err);
        scriptData = []; // Fallback to empty data
        return scriptData;
    }
}

function initVerbalBackchannels() {
  let verbalBackchannels;
    if (!verbalBackchannelsEnabled || verbalBackchannelsPath == "" || verbalBackchannelsPath == "N/A") {
        verbalBackchannels = []; // Fallback to empty data
        return verbalBackchannels;
    }
    try {
        verbalBackchannels = JSON.parse(fs.readFileSync(verbalBackchannelsPath, 'utf8'));
        console.log("Successfully preloaded verbal backchannels at: ", verbalBackchannelsPath);
        return verbalBackchannels;
    } catch (err) {
        console.error("Error reading or parsing Placeholders.json:", err);
        verbalBackchannels = []; // Fallback to empty data
        return verbalBackchannels;
    }
}


module.exports = {
    generateOpenConversationScript,
    initConversationScript,
    initVerbalBackchannels
}