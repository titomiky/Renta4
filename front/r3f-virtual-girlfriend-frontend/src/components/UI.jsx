import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";

export const UI = ({ hidden, ...props }) => {
  const input = useRef();
  const {
    chat,
    loading,
    cameraZoomed,
    setCameraZoomed,
    message,
    audioBlocked,
  } = useChat();
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const pendingTranscriptRef = useRef("");
  const [listening, setListening] = useState(false);

  const sendMessage = (overrideText) => {
    const field = input.current;
    const rawValue =
      typeof overrideText === "string"
        ? overrideText
        : field?.value ?? "";
    const text = rawValue.trim();
    if (!text) {
      if (typeof overrideText === "string" && field) {
        field.value = rawValue;
      }
      return false;
    }
    if (!loading && !message) {
      chat(text);
      if (field) {
        field.value = "";
      }
      return true;
    }
    if (typeof overrideText === "string" && field) {
      field.value = rawValue;
    }
    return false;
  };
  if (hidden) {
    return null;
  }

  const initRecognition = () => {
    if (typeof window === "undefined") {
      return null;
    }
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API is not available in this browser.");
      return null;
    }
    if (!recognitionRef.current) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = "es-ES";
      recog.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const currentValue = input.current?.value ?? "";
        const combined = [currentValue.trim(), transcript.trim()]
          .filter(Boolean)
          .join(" ");
        transcriptRef.current = combined;
        if (input.current) {
          input.current.value = combined;
        }
        if (result.isFinal) {
          try {
            recog.stop();
          } catch (err) {
            console.error("Failed to stop recognition", err);
          }
        }
      };
      recog.onend = () => {
        setListening(false);
        const finalTranscript = transcriptRef.current.trim();
        transcriptRef.current = "";
        if (!finalTranscript) {
          pendingTranscriptRef.current = "";
          return;
        }
        if (input.current) {
          input.current.value = finalTranscript;
        }
        const sent = sendMessage(finalTranscript);
        if (!sent) {
          pendingTranscriptRef.current = finalTranscript;
        } else {
          pendingTranscriptRef.current = "";
        }
      };
      recog.onerror = (event) => {
        console.error("Speech recognition error", event);
        setListening(false);
        transcriptRef.current = "";
        pendingTranscriptRef.current = "";
      };
      recognitionRef.current = recog;
    }
    return recognitionRef.current;
  };

  const toggleRecognition = () => {
    const recog = initRecognition();
    if (!recog) {
      return;
    }
    if (!listening) {
      pendingTranscriptRef.current = "";
      transcriptRef.current = "";
      setListening(true);
      try {
        recog.start();
      } catch (err) {
        console.error("Failed to start recognition", err);
        setListening(false);
      }
    } else {
      try {
        recog.stop();
      } catch (err) {
        console.error("Failed to stop recognition", err);
        setListening(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current && listening) {
        recognitionRef.current.stop();
      }
    };
  }, [listening]);

  useEffect(() => {
    if (!pendingTranscriptRef.current) {
      return;
    }
    if (loading || message) {
      return;
    }
    const pendingText = pendingTranscriptRef.current;
    if (input.current) {
      input.current.value = pendingText;
    }
    const sent = sendMessage(pendingText);
    if (sent) {
      pendingTranscriptRef.current = "";
    }
  }, [loading, message]);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex justify-between p-4 flex-col pointer-events-none">
        {audioBlocked && (
          <div className="pointer-events-auto self-center bg-amber-200 text-amber-900 px-4 py-2 rounded-md shadow">
            Activa el audio haciendo clic en la pantalla para que Renti pueda hablar.
          </div>
        )}
        <div className="self-start backdrop-blur-md bg-white bg-opacity-50 p-4 rounded-lg">
          <h1 className="font-black text-xl">Renta 4</h1>
          <p>Innovación rentable</p>
        </div>
        <div className="w-full flex flex-col items-end justify-center gap-4">
          <button
            onClick={() => setCameraZoomed(!cameraZoomed)}
            className="pointer-events-auto bg-[#8c2f3f] hover:bg-[#8c2f3f] text-white p-4 rounded-md"
          >
            {cameraZoomed ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                />
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto max-w-screen-sm w-full mx-auto">
          <input
            className="w-full placeholder:text-gray-800 placeholder:italic p-4 rounded-md bg-opacity-50 bg-white backdrop-blur-md"
            placeholder="Pregunta lo que quieras..."
            ref={input}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
          />
          <button
            type="button"
            onClick={toggleRecognition}
            className={`bg-[#8c2f3f] hover:bg-[#8c2f3f] text-white p-4 px-10 font-semibold uppercase rounded-md ${
              listening ? "opacity-80" : ""
            }`}
          >
            {listening ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6l12 12M9 18h6m-3-3v3m0-3a3 3 0 01-3-3V7a3 3 0 016 0v5a3 3 0 01-3 3z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a4.5 4.5 0 004.5-4.5V7.5a4.5 4.5 0 10-9 0v6.75a4.5 4.5 0 004.5 4.5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 18.75v1.5a2.25 2.25 0 004.5 0v-1.5m-7.5-6V12a7.5 7.5 0 0015 0v.75"
                />
              </svg>
            )}
          </button>
          <button
            disabled={loading || message}
            onClick={sendMessage}
            className={`bg-[#8c2f3f] hover:bg-[#8c2f3f] text-white p-4 px-10 font-semibold uppercase rounded-md ${
              loading || message ? "cursor-not-allowed opacity-30" : ""
            }`}
          >
            Enviar
          </button>
        </div>
      </div>
    </>
  );
};
