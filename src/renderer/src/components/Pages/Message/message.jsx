import React, { useState, useEffect, useRef } from "react";
import supabase from "../../../../Supabase";
import "./message.css";

const MessagePage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState(null);
  const [nickname, setNickname] = useState("");
  const messagesEndRef = useRef(null);

  // Load user ID and nickname from localStorage
  useEffect(() => {
    const cachedUserId = localStorage.getItem("user_id"); // Should store UUID
    const cachedNickname = localStorage.getItem("nickname");

    if (cachedUserId) {
      setUserId(cachedUserId);
    } else {
      console.error("User not logged in: No cached user ID found.");
    }

    if (cachedNickname) {
      setNickname(cachedNickname);
    } else {
      console.error("No cached nickname found.");
    }
  }, []);

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
            console.log("New message from view:", data);
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

    if (!userId) {
      alert("User ID missing.");
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          content: newMessage,
          user_id: userId, // This is the UUID or public_id
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
