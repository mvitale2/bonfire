import { useState, useEffect, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UserContext } from "../../../UserContext.jsx";
import supabase from "../../../../Supabase.jsx";
import "./message.css";
import Tray from "../../UI Components/Tray/Tray.jsx";
import { IoSend } from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import defaultAvatar from "../../../assets/default_avatar.png";
import remarkEmoji from "remark-emoji";


const Message = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [groups, setGroups] = useState([]);
  const messagesEndRef = useRef(null);
  const { nickname, id, avatar, hideNickname, hideProfilePic } = useContext(UserContext);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select("id, name");

      if (!error) setGroups(data || []);
    };

    fetchGroups();

    const groupChannel = supabase
      .channel("realtime-chat_rooms")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_rooms",
        },
        (payload) => {
          // Append the new room
          const newRoom = payload.new;
          setGroups((prev) => [...prev, newRoom]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(groupChannel);
    };
  }, []);



  // Fetch messages for selected room
  useEffect(() => {
    const fetchMessages = async () => {
      const query = supabase
        .from("message_view")
        .select("*")
        .order("created_at", { ascending: true });

      const { data, error } = roomId
        ? await query.eq("room_id", roomId)
        : await query.is("room_id", null);

      if (error) {
        console.error("Error fetching messages:", error.message);
      } else {
        setMessages(data);
      }
    };

    fetchMessages();
  }, [roomId]);

  // Realtime updates
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

          if (!error && (!roomId || data.room_id === roomId)) {
            setMessages((prev) => [...prev, data]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    if (!id) return alert("User ID is missing.");

    const { error } = await supabase.from("messages").insert([
      {
        content: newMessage,
        user_id: id,
        room_id: roomId || null,
      },
    ]);

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
        {/* Chat group selector */}
        <div style={{ width: "100%", padding: "10px" }}>
          <select
            value={roomId || ""}
            onChange={(e) => {
              navigate(`/messages/${e.target.value}`);
            }}
          >
            <option value="">🌐 Global Chat</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        {/* Message List */}
        <div className="messages-list">
          {messages.map((msg) => {
            const isCurrentUser = msg.user_id === id;
            const displayName = isCurrentUser && hideNickname ? "Anonymous" : msg.nickname;
            const displayAvatar = isCurrentUser && hideProfilePic ? defaultAvatar : msg.profile_pic_url || defaultAvatar;

            return (
              <div key={msg.message_id || msg.id} className="message">
                <div className="message-time">
                  <img
                    src={displayAvatar}
                    alt="avatar"
                    className="avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = defaultAvatar;
                    }}
                  />
                  <span>
                    {displayName} – {new Date(msg.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="message-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkEmoji]}
                    rehypePlugins={[
                      [
                        rehypeExternalLinks,
                        {
                          rel: ["noopener", "noreferrer", "nofollow"],
                          target: "_blank",
                        },
                      ],
                    ]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>


        {/* Input field */}
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

export default Message;
