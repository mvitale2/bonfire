import { useState, useEffect, useRef } from "react";
import supabase from "../../../../Supabase";
import "./message.css";

const MessagePage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState(null);
  const messagesEndRef = useRef(null);

  // Load user ID from localStorage
  useEffect(() => {
    const cachedUserId = localStorage.getItem("user_id");
    if (cachedUserId) {
      setUserId(cachedUserId); // This is the public_id (uuid)
    } else {
      console.error("User not logged in: No cached user ID found.");
    }
  }, []);

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
    if (!newMessage.trim() || !userId) {
      console.error("Missing message content or user ID");
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert([{ content: newMessage, user_id: userId }])
      .select(); // important: ensures data is returned

    console.log("Message insert result:", { data, error });

    if (error) {
      console.error("Error sending message:", error.message);
    } else if (!error) {
        setNewMessage(""); 
      }
    else {
      console.warn("Unexpected insert result:", data);
    }
  };
  
  return (
    <div className="messages-page">
      <div className="messages-list">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <div className="message-content">{msg.content}</div>
            <div className="message-time">
              <strong>{msg.nickname}</strong> –{" "}
              {new Date(msg.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-container">
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="message-input"
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default MessagePage;
