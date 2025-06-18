import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../../UserContext.jsx";
import supabase from "../../../../Supabase.jsx";
import "./message.css";
import Tray from "../../UI Components/Tray/Tray.jsx";
import { IoSend } from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import Avatar from "../../UI Components/Avatar/Avatar.jsx";

const MessagePage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const { nickname, id } = useContext(UserContext);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("message_view")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error.message);
      } else {
        setMessages(data);
      }
    };

    fetchMessages();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const { data, error } = await supabase
            .from("message_view")
            .select("*")
            .eq("message_id", payload.new.id)
            .single();

          if (error) {
            console.error(
              "Error fetching new message from view:",
              error.message
            );
          } else {
            // console.log("New message from view:", data);
            setMessages((prev) => [...prev, data]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    if (!id) {
      alert("User ID missing.");
      return;
    }

    const { error } = await supabase
      .from("messages")
      .insert([
        {
          content: newMessage,
          user_id: id,
        },
      ])
      .select();

    if (error) {
      console.error("Error sending message:", error.message);
    } else {
      setNewMessage("");
    }
  };

  return (
    <>
      <Tray nickname={nickname} />
      <div className="messages-page">
        <div className="messages-list">
          {messages.map((msg) => (
            <div key={msg.id} className="message">
              <div className="message-time">
                <Avatar otherUserId={msg.user_id} />
                <span>{`${msg.nickname} - ${new Date(msg.created_at).toLocaleString()}`}</span>
              </div>
              <div className="message-content">
                <ReactMarkdown
                  rehypePlugins={[
                    [
                      rehypeExternalLinks,
                      {
                        rel: ["noopener noreferrer nofollow"],
                        target: ["_blank"],
                      },
                    ],
                  ]}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="message-input-container">
          <div className="input-with-button">
            <input
              type="text"
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="message-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button onClick={handleSendMessage}>
              <IoSend />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MessagePage;
