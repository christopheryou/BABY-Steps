const { scenario } = require('../scenario.js');

const apiKey = scenario?.largeLanguageModel?.apiKey || "N/A";
const vectorStoreId = scenario?.vectorStoreId || "N/A";
const model = scenario?.largeLanguageModel?.model || "N/A";
const OpenAI = require('openai');

async function generateKnowledgeBaseResponse(messages) {
  try {
      console.log("Generating message potentially using knowledge base...");        
      const requestPayload = {
          model: model,
          input: messages,
      };
      
      if (vectorStoreId && vectorStoreId !== "N/A") {
          console.log("Attaching vectorStore for retrieval-augmented generation: ", vectorStoreId)
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
      console.log("Generating message without knowledge base...");  
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



// This is a helper function for the Audio route. If you need to transcribe audio for the "words, wtimes, and wdurations" and your method of audio generation does not provide it automatically, you can post process using transcribeAudio. 
// This may be slower though.
async function transcribeAudio(audioFilePath) {
    try {
      // Transcribe audio
      const transcriptionResponse = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
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

// The following three functions are helper functions if you want to upload a file for a knowledgebase.
// uploadKnowledgeBase auto creates a vector store if none is provided in the scenario.js parameters.
async function uploadKnowledgeBase(fileStream, vectorStoreId = null) {
    // console.log(fileStream, apiKey);
    try {
        const openai = new OpenAI({ apiKey });

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
        const openai = new OpenAI({ apiKey });
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
        const openai = new OpenAI({ apiKey });
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


module.exports = {
  transcribeAudio,
  generateResponse,
  generateKnowledgeBaseResponse
}