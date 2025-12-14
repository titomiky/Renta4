import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import OpenAI from "openai";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-",
});

const azureSpeechKey = process.env.AZURE_SPEECH_KEY;
const azureSpeechRegion = process.env.AZURE_SPEECH_REGION;
const azureSpeechVoice =
  process.env.AZURE_SPEECH_VOICE?.trim() || "es-ES-ElviraNeural";
const azureSpeechStyle =
  process.env.AZURE_SPEECH_STYLE?.trim() || "general";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
const port = 3000;

const DEFAULT_VISEME_DURATION = 0.12;
const MIN_SEGMENT_LENGTH = 0.05;

const azureVisemeToRhubarb = {
  0: "X",
  1: "A",
  2: "A",
  3: "B",
  4: "C",
  5: "C",
  6: "C",
  7: "D",
  8: "B",
  9: "B",
  10: "B",
  11: "A",
  12: "H",
  13: "D",
  14: "E",
  15: "H",
  16: "F",
  17: "H",
  18: "H",
  19: "F",
  20: "H",
  21: "B",
  22: "G",
};

const roundTime = (value) => Math.round(value * 1000) / 1000;

const resolveRelativePath = (relativePath) =>
  path.isAbsolute(relativePath) ? relativePath : path.join(__dirname, relativePath);

const ensureAudiosDir = async () => {
  const audioDir = resolveRelativePath("audios");
  await fs.mkdir(audioDir, { recursive: true });
  return audioDir;
};

const escapeSsml = (input = "") =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildSsml = (text) => `
<speak version="1.0" xml:lang="es-ES"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts">
  <voice name="${azureSpeechVoice}">
    <mstts:express-as style="${azureSpeechStyle}">
      ${escapeSsml(text)}
    </mstts:express-as>
  </voice>
</speak>`;

const synthesizeSpeechWithVisemes = async (text, index) => {
  if (!azureSpeechKey || !azureSpeechRegion) {
    throw new Error("Azure Speech credentials are not configured");
  }

  await ensureAudiosDir();

  const fileName = `audios/message_${index}.mp3`;
  const absoluteAudioPath = resolveRelativePath(fileName);
  const visemeEvents = [];

  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      azureSpeechKey,
      azureSpeechRegion
    );
    speechConfig.speechSynthesisVoiceName = azureSpeechVoice;
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(absoluteAudioPath);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    synthesizer.visemeReceived = (_s, e) => {
      visemeEvents.push({
        id: e.visemeId,
        offsetSeconds: e.audioOffset / 1e7,
      });
    };

    synthesizer.speakSsmlAsync(
      buildSsml(text),
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const audioDurationSec =
            typeof result.audioDuration === "number"
              ? result.audioDuration / 1e7
              : undefined;
          resolve({
            fileName,
            visemes: visemeEvents,
            audioDurationSec,
          });
        } else {
          reject(
            new Error(
              result.errorDetails || "Azure speech synthesis did not complete"
            )
          );
        }
      },
      (error) => {
        synthesizer.close();
        reject(error);
      }
    );
  });
};

const convertVisemesToMouthCues = (visemeEvents, totalDurationSec) => {
  if (!Array.isArray(visemeEvents) || visemeEvents.length === 0) {
    const duration = totalDurationSec ?? DEFAULT_VISEME_DURATION;
    return [
      {
        start: 0,
        end: roundTime(Math.max(duration, MIN_SEGMENT_LENGTH)),
        value: "X",
      },
    ];
  }

  const sorted = visemeEvents
    .filter(
      (event) =>
        event &&
        typeof event.offsetSeconds === "number" &&
        Number.isFinite(event.offsetSeconds)
    )
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds);

  const cues = sorted.map((event, index) => {
    const start = roundTime(Math.max(0, event.offsetSeconds));
    const next = sorted[index + 1];
    const nextStart = next
      ? Math.max(next.offsetSeconds, start)
      : totalDurationSec ?? start + DEFAULT_VISEME_DURATION;
    let end = roundTime(Math.max(start + MIN_SEGMENT_LENGTH, nextStart));
    const value = azureVisemeToRhubarb[event.id] || "X";
    return { start, end, value };
  });

  const merged = [];
  for (const cue of cues) {
    const last = merged[merged.length - 1];
    if (last && last.value === cue.value && Math.abs(last.end - cue.start) < 0.001) {
      last.end = cue.end;
    } else {
      merged.push({ ...cue });
    }
  }

  if (merged.length === 0) {
    return [
      {
        start: 0,
        end: roundTime(totalDurationSec ?? DEFAULT_VISEME_DURATION),
        value: "X",
      },
    ];
  }

  if (merged[0].start > 0) {
    merged.unshift({
      start: 0,
      end: merged[0].start,
      value: "X",
    });
  }

  const lastCue = merged[merged.length - 1];
  const duration =
    totalDurationSec ?? Math.max(lastCue.end, lastCue.start + DEFAULT_VISEME_DURATION);
  if (duration > lastCue.end) {
    merged.push({
      start: lastCue.end,
      end: roundTime(duration),
      value: "X",
    });
  }

  return merged;
};

const buildLipsyncData = (visemeEvents, audioDurationSec) => {
  const mouthCues = convertVisemesToMouthCues(visemeEvents, audioDurationSec);
  const duration =
    audioDurationSec ?? (mouthCues.length ? mouthCues[mouthCues.length - 1].end : 0);
  return {
    metadata: {
      voice: azureSpeechVoice,
      duration,
    },
    mouthCues,
  };
};

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
    return;
  }
  if (!azureSpeechKey || !azureSpeechRegion || openai.apiKey === "-") {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and Azure bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      max_tokens: 1000,
      temperature: 0.6,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: `
        You are a virtual girlfriend.
        You will always reply with a JSON array of messages. With a maximum of 3 messages.
        Each message has a text, facialExpression, and animation property.
        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry. 
        `,
        },
        {
          role: "user",
          content: userMessage || "Hello",
        },
      ],
    });
  } catch (error) {
    console.error("OpenAI completion failed", error);
    res.status(502).send({
      error: "OpenAI completion failed",
      detail: error.message,
    });
    return;
  }

  let messages = JSON.parse(completion.choices[0].message.content);
  if (messages.messages) {
    messages = messages.messages;
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const textInput = message.text;

    let synthesis;
    try {
      synthesis = await synthesizeSpeechWithVisemes(textInput, i);
    } catch (error) {
      console.error("Azure text-to-speech failed", error);
      res.status(502).send({
        error: "Azure text-to-speech failed",
        detail: error.message,
      });
      return;
    }

    const lipsync = buildLipsyncData(synthesis.visemes, synthesis.audioDurationSec);
    const lipsyncFile = `audios/message_${i}.json`;
    await fs.writeFile(
      resolveRelativePath(lipsyncFile),
      JSON.stringify(lipsync, null, 2),
      "utf8"
    );

    message.audio = await audioFileToBase64(synthesis.fileName);
    message.lipsync = lipsync;
  }

  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(resolveRelativePath(file), "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(resolveRelativePath(file));
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});
