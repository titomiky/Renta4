import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState();
  const [loading, setLoading] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(true);
  const initializationRef = useRef(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const chat = useCallback(async (message) => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }
      const data = await response.json();
      const resp = Array.isArray(data?.messages) ? data.messages : [];
      if (resp.length) {
        setMessages((messages) => [...messages, ...resp]);
      }
    } catch (error) {
      console.error("Failed to fetch chat response", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const onMessagePlayed = () => {
    setMessages((messages) => messages.slice(1));
  };

  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
    } else {
      setMessage(null);
    }
  }, [messages]);

  useEffect(() => {
    if (initializationRef.current) {
      return;
    }
    initializationRef.current = true;
    chat("");
  }, [chat]);

  return (
    <ChatContext.Provider
      value={{
        chat,
        message,
        onMessagePlayed,
        loading,
        cameraZoomed,
        setCameraZoomed,
        audioBlocked,
        setAudioBlocked,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
