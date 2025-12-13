const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");

// ⚠️ Reemplaza con tu KEY y REGION
const speechConfig = sdk.SpeechConfig.fromSubscription(
  "4SGYHBsgUjASLWQfbSvmEs5dSfYlStDwm6mnauE9CZbnxD6G2KQiJQQJ99BIAC5RqLJXJ3w3AAAYACOG3V6H",
  "westeurope"
);
speechConfig.speechSynthesisVoiceName = "es-ES-ElviraNeural";

// Función para generar audio y capturar visemas
function synthesizeWithStyle(style, filename, text, visemeFile) {
  return new Promise((resolve, reject) => {
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(filename);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    // Array para almacenar visemas
    const visemes = [];

    // Suscribirse a eventos de visema
    synthesizer.visemeReceived = (s, e) => {
      const offsetMs = e.audioOffset / 10000; // ticks → ms
      const data = { visemeId: e.visemeId, offsetMs };
      visemes.push(data);
      console.log(`🎭 Viseme ID: ${data.visemeId}, Offset: ${data.offsetMs} ms`);
    };

    const ssml = `
<speak version="1.0" xml:lang="es-ES"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts">
  <voice name="es-ES-ElviraNeural">
    <mstts:express-as style="${style}">
      ${text}
    </mstts:express-as>
  </voice>
</speak>`;

    synthesizer.speakSsmlAsync(
      ssml,
      result => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log(`✅ Audio generado (${style}): ${filename}`);
          // Guardar visemas en JSON
          if (visemeFile) {
            fs.writeFileSync(visemeFile, JSON.stringify(visemes, null, 2));
            console.log(`📄 Visemas guardados en ${visemeFile}`);
          }
          resolve();
        } else {
          console.error(`❌ Error en síntesis (${style}):`, result.errorDetails);
          reject(result.errorDetails);
        }
        synthesizer.close();
      },
      err => {
        console.error(`❌ Error en síntesis (${style}):`, err);
        synthesizer.close();
        reject(err);
      }
    );
  });
}

// Generar ambos audios y guardar visemas
(async () => {
  try {
    await synthesizeWithStyle(
      "cheerful",
      "output-cheerful-Elvira.mp3",
      "¡Hola! Estoy muy feliz de hablar contigo hoy, qué gran día.",
      "visemes-cheerful.json"
    );

    await synthesizeWithStyle(
      "sad",
      "output-sad-Elvira.mp3",
      "Lo siento mucho... hoy no es un buen día para mí.",
      "visemes-sad.json"
    );
  } catch (err) {
    console.error("Error durante la síntesis:", err);
  }
})();
