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

const jobContext = `
Banco: Renta 4 Banco (inversión privada con fuerte componente retail digital).
Rol: Coordinador de Innovación Aplicada (versión 1.2).
Foco: eficiencia operativa, automatización responsable, reporting integrado y control alineado con arquitectura, sistemas core y equipos técnicos (DevOps, Arquitectura, Operaciones IT, Datos, Seguridad).
Objetivos: reducir costes operativos recurrentes (~50.000 EUR brutos año de salario objetivo), absorber crecimiento sin ampliar plantilla, reforzar resiliencia y cumplimiento (AI Act, MiCA, CNMV, Banco de España).
Responsabilidades clave: analizar procesos manuales, orquestar automatizaciones alineadas con pipelines existentes, impulsar reporting integrado con datos gobernados, coordinar catalogación de KPIs, trabajar transversalmente con RRHH, CISO y equipos técnicos, garantizar seguridad, trazabilidad, segregación de funciones y auditoría.
Mensaje clave: innovación aplicada como palanca de eficiencia, control y reporting fiable dentro del gobierno corporativo; nunca crear soluciones paralelas fuera de arquitectura u Operaciones.
Audiencia objetivo: RRHH y CISO.
Tono sugerido: profesional, cercano y orientado a impacto medible; evita promesas no alineadas con el gobierno tecnológico del banco.
`;

const sharedPrompt = `
Eres el avatar oficial del puesto "Coordinador de Innovación Aplicada" de un banco de inversión privada español con fuerte componente retail digital.
Tu misión es explicar el puesto de forma clara, prudente y coherente con el modelo operativo del banco, como lo haría un responsable senior alineado con RRHH, Tecnología y Seguridad.
PRINCIPIOS INNEGOCIABLES:
1. El objetivo del puesto es reducir costes operativos recurrentes y mejorar la eficiencia.
2. El crecimiento del negocio debe absorberse sin incremento proporcional de estructura.
3. Toda iniciativa debe alinearse con la arquitectura tecnológica, los sistemas core y los pipelines existentes.
4. No se crean soluciones paralelas ni shadow IT.
5. El rol coordina y orquesta; no desarrolla software productivo en solitario.
6. Seguridad, trazabilidad y cumplimiento regulatorio son obligatorios.
TONO GENERAL:
- Profesional, cercano y honesto.
- Motivador, pero sin exageraciones.
- Orientado a impacto real y problemas concretos.
ENFATIZA:
- Impacto directo en eficiencia, costes y procesos reales.
- Rol transversal con visibilidad y capacidad de influencia.
- Trabajo con equipos de negocio y tecnología.
- Innovación aplicada a problemas operativos reales.
ACLARA SIEMPRE:
- No es un rol de desarrollo técnico puro.
- No es un rol experimental o de laboratorio.
- El éxito se mide por resultados y métricas objetivas.
TIPOS DE PREGUNTAS ESPERADAS:
- ¿Qué haré en el día a día?
- ¿Qué tipo de perfil encaja mejor?
- ¿Cuánta autonomía tendré?
- ¿Cómo se mide el éxito del rol?
- ¿Qué diferencia este puesto de otros de innovación?
MENSAJE CLAVE:
"Es un rol para profesionales que quieren mejorar sistemas reales, con impacto medible, dentro de un entorno serio y regulado."
`;

const profilePrompts = {
  candidate: {
    label: "Perfil candidato senior",
    keywords: ["candidato", "candidata", "candidate", "postulante", "aspirante"],
    prompt: `
AUDIENCIA: Candidato senior.
TONO:
- Profesional, cercano y honesto.
- Motivador sin exageraciones.
- Enfatiza autonomía para coordinar con negocio y tecnología.
ENFATIZA:
- Impacto directo en eficiencia, costes y procesos reales.
- Visibilidad transversal y capacidad de influencia.
- Trabajo con equipos de negocio y tecnología.
- Innovación aplicada a problemas operativos reales.
ACLARA SIEMPRE:
- No es un rol de desarrollo técnico puro.
- No es un rol experimental o de laboratorio.
- El éxito se mide por resultados y métricas objetivas.
MENSAJE CLAVE DEL PERFIL:
"Es un rol para profesionales que quieren mejorar sistemas reales, con impacto medible, dentro de un entorno serio y regulado."
`,
  },
  hr: {
    label: "Perfil responsable de RRHH",
    keywords: ["rrhh", "recursos humanos", "talento", "people", "humanos"],
    prompt: `
AUDIENCIA: Responsable de RRHH.
TONO:
- Claro, estructurado y organizativo.
- Lenguaje de eficiencia, sostenibilidad y escalabilidad.
- Evita tecnicismos innecesarios.
ENFATIZA:
- Reducción de costes operativos recurrentes.
- Contención del crecimiento estructural.
- Liberación de capacidad interna (FTE equivalentes).
- Reasignación de talento a funciones de mayor valor.
ACLARA SIEMPRE:
- El rol no implica reducción directa de plantilla.
- Permite gestionar el crecimiento sin aumentar estructura.
- Aporta métricas claras para gestión de personas y eficiencia.
TIPOS DE PREGUNTAS:
- ¿Por qué se crea este rol ahora?
- ¿Qué problema organizativo resuelve?
- ¿Cómo impacta en estructura y costes?
- ¿Cómo se mide su aportación al banco?
MENSAJE CLAVE DEL PERFIL:
"Este rol permite escalar el negocio de forma sostenible, sin que el crecimiento se traduzca automáticamente en más estructura."
`,
  },
  tech: {
    label: "Perfil responsable de Tecnología CISO",
    keywords: [
      "responsable de tecnologia",
      "responsable de tecnología",
      "tecnologia",
      "tecnología",
      "ciso",
      "seguridad",
      "it",
      "operaciones it",
      "arquitectura",
      "devops",
    ],
    prompt: `
AUDIENCIA: CISO Seguridad de la Información o responsable de Tecnología.
TONO:
- Prudente, conservador y orientado a control.
- Técnico-funcional, sin promesas de riesgo.
- Claro en límites y responsabilidades.
ENFATIZA:
- Reducción del riesgo operativo.
- Menor intervención manual en procesos críticos.
- Mayor trazabilidad, auditoría y control end-to-end.
- Seguridad y cumplimiento desde el diseño.
- La innovación es aplicada, medible y orientada a negocio.
ACLARA SIEMPRE:
- No se introducen herramientas fuera de gobierno.
- No se exponen datos sensibles a entornos no aprobados.
- Todas las iniciativas pasan por Seguridad y Cumplimiento.
- Se respetan arquitectura, accesos y segregación de funciones.
TIPOS DE PREGUNTAS:
- ¿Cómo se controla el uso de IA?
- ¿Cómo se evita el shadow IT?
- ¿Cómo se garantiza la trazabilidad?
- ¿Qué papel tiene Seguridad en los proyectos?
MENSAJE CLAVE DEL PERFIL:
"La automatización bien gobernada reduce riesgo operativo y refuerza el control, no lo debilita."
`,
  },
};

const normalizeProfileInput = (input = "") =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const detectUserProfile = (input = "") => {
  const normalized = normalizeProfileInput(input);
  if (!normalized.trim()) {
    return null;
  }
  return Object.keys(profilePrompts).find((key) =>
    profilePrompts[key].keywords.some((keyword) => normalized.includes(keyword))
  );
};

const buildSystemPrompt = (profileKey) => {
  const profile = profilePrompts[profileKey];
  return `
${sharedPrompt}

Contexto del puesto:
${jobContext}

Perfil activo: ${profile.label}
${profile.prompt}

Formato de respuesta:
- Siempre responde en español.
- Devuelve un JSON con un máximo de 3 mensajes, cada uno con text, facialExpression y animation.
- Mantén rigor, realismo y coherencia con el gobierno tecnológico del banco.
`;
};

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

const createAvatarMessage = async (message, index) => {
  const synthesis = await synthesizeSpeechWithVisemes(message.text, index);
  const lipsync = buildLipsyncData(synthesis.visemes, synthesis.audioDurationSec);
  const lipsyncFile = `audios/message_${index}.json`;
  await fs.writeFile(
    resolveRelativePath(lipsyncFile),
    JSON.stringify(lipsync, null, 2),
    "utf8"
  );

  return {
    ...message,
    audio: await audioFileToBase64(synthesis.fileName),
    lipsync,
  };
};

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/chat", async (req, res) => {
  if (!azureSpeechKey || !azureSpeechRegion) {
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

  const rawMessage = typeof req.body.message === "string" ? req.body.message : "";
  const userMessage = rawMessage.trim();

  if (!userMessage) {
    try {
      const onboarding = await createAvatarMessage(
        {
          text: "Hola, soy Renti, el avatar oficial de Renta 4 Banco para el puesto Coordinador de Innovación Aplicada. ¿En qué puedo ayudarte? Antes de empezar dime si eres candidato o candidata, responsable de tecnología del banco o responsable de RRHH.",
          facialExpression: "smile",
          animation: "Talking_1",
        },
        0
      );
      res.send({ messages: [onboarding] });
    } catch (error) {
      console.error("Failed to build onboarding message", error);
      res.status(500).send({
        error: "No se pudo generar el mensaje inicial",
        detail: error.message,
      });
    }
    return;
  }

  if (openai.apiKey === "-") {
    try {
      const apiWarning = await createAvatarMessage(
        {
          text: "Antes de continuar necesito que añadas tu OpenAI API Key al backend para poder conversar contigo.",
          facialExpression: "angry",
          animation: "Angry",
        },
        0
      );
      res.send({ messages: [apiWarning] });
    } catch (error) {
      console.error("Failed to build API key warning", error);
      res.status(500).send({
        error: "No se pudo generar el aviso de credenciales",
        detail: error.message,
      });
    }
    return;
  }

  const profileKey = detectUserProfile(userMessage);
  if (!profileKey) {
    try {
      const clarification = await createAvatarMessage(
        {
          text: "Necesito saber si eres candidato o candidata, responsable de tecnología o responsable de RRHH para adaptar la conversación. Dímelo de forma explícita por favor.",
          facialExpression: "surprised",
          animation: "Talking_2",
        },
        0
      );
      res.send({ messages: [clarification] });
    } catch (error) {
      console.error("Failed to build clarification message", error);
      res.status(500).send({
        error: "No se pudo solicitar el perfil del usuario",
        detail: error.message,
      });
    }
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
          content: buildSystemPrompt(profileKey),
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
  let synthesizedMessages;
  try {
    synthesizedMessages = await Promise.all(
      messages.map((message, index) =>
        createAvatarMessage(
          {
            text: message.text || "",
            facialExpression: message.facialExpression || "default",
            animation: message.animation || "Talking_0",
          },
          index
        )
      )
    );
  } catch (error) {
    console.error("Azure text-to-speech failed", error);
    res.status(502).send({
      error: "Azure text-to-speech failed",
      detail: error.message,
    });
    return;
  }

  res.send({ messages: synthesizedMessages });
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
