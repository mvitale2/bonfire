import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../../UserContext.jsx";
import supabase from "../../../../Supabase";
import "./message.css";
import Tray from "../../UI Components/Tray/Tray.jsx";
import { IoSend } from "react-icons/io5";

const MessagePage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const { id } = useContext(UserContext);
  const { nickname } = useContext(UserContext);
  const messagesEndRef = useRef(null);

  // Fetch messages from message_view (includes nickname)
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

  // Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id) return;

    const { error } = await supabase
      .from("messages")
      .insert([{ content: newMessage, user_id: id }]);

    if (error) {
      console.error("Error sending message:", error.message);
    } else {
      setNewMessage("");
      // Refetch messages so nicknames are included
      const { data, error: fetchError } = await supabase
        .from("message_view")
        .select("*")
        .order("created_at", { ascending: true });
      if (!fetchError) setMessages(data);
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
                <strong>{msg.nickname}</strong> –{" "}
                {new Date(msg.created_at).toLocaleString()}
              </div>
              <div className="message-content">{msg.content}</div>
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
