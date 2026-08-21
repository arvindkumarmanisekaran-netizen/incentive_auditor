import { useState } from "react";

interface Props {
  onInvestigationRequest: (representativeId: string, startDate: string, endDate: string) => void;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessage {
  sender: "You" | "Agent";
  text: string;
}

export default function AIChatAssistant({ onInvestigationRequest }: Props) {
  const [open, setOpen] = useState(false);

  const [message, setMessage] = useState("");

  const [chat, setChat] = useState<ChatMessage[]>([]);

  const [conversation, setConversation] = useState<ConversationMessage[]>([]);

  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!message.trim() || loading) {
      return;
    }

    const userMessage = message.trim();

    setMessage("");

    setChat((current) => [
      ...current,
      {
        sender: "You",
        text: userMessage,
      },
    ]);

    const updatedConversation = [
      ...conversation,
      {
        role: "user" as const,
        content: userMessage,
      },
    ];

    setConversation(updatedConversation);

    setLoading(true);

    try {
      const response = await fetch("/api/chat/investigation", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message: userMessage,

          conversation: updatedConversation,
        }),
      });

      if (!response.ok) {
        throw new Error("Chat service unavailable");
      }

      const data = await response.json();

      console.log("CHAT RESPONSE:", data);

      const agentMessage = data.message ?? "Request processed";

      setChat((current) => [
        ...current,
        {
          sender: "Agent",
          text: agentMessage,
        },
      ]);

      /*
        IMPORTANT:
        Store structured assistant response.
        Not only text.
      */

      setConversation((current) => [
        ...current,
        {
          role: "assistant",
          content: JSON.stringify(data),
        },
      ]);

      /*
        Start investigation
      */

      if (
        data.action === "RUN_ANALYSIS" &&
        data.representative_id &&
        data.start_date &&
        data.end_date
      ) {
        onInvestigationRequest(
          data.representative_id,

          data.start_date,

          data.end_date,
        );

        setChat((current) => [
          ...current,
          {
            sender: "Agent",
            text: "Investigation started.",
          },
        ]);
      }
    } catch (error) {
      console.error("CHAT ERROR", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      setChat((current) => [
        ...current,
        {
          sender: "Agent",
          text: errorMessage,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      sendMessage();
    }
  }

  return (
    <>
      <button className="chatbot-floating-button" onClick={() => setOpen(!open)}>
        🤖
      </button>

      {open && (
        <div className="chatbot-window">
          <div className="chatbot-header">AI Assistant</div>

          <div className="chatbot-messages">
            {chat.length === 0 && (
              <div className="chatbot-placeholder">
                Ask anything:
                <br />
                "Analyze Steve July 2026"
                <br />
                "Give Sharma analysis"
                <br />
                "Show active representatives"
              </div>
            )}

            {chat.map((item, index) => (
              <div
                key={index}
                className={item.sender === "You" ? "chat-user-message" : "chat-agent-message"}
              >
                <strong>{item.sender}:</strong> {item.text}
              </div>
            ))}

            {loading && <div className="chat-agent-message">Thinking...</div>}
          </div>

          <div className="chatbot-input">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI assistant..."
              disabled={loading}
            />

            <button onClick={sendMessage} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
