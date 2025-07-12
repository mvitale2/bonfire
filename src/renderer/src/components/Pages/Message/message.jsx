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
import getNickname from "../../../getNickname.jsx";
import Avatar from "../../UI Components/Avatar/Avatar.jsx";
import rehypeHighlight from "rehype-highlight";
import CallPage from "../webrtc/callpage.jsx"; // <-- import

const Message = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [groupIds, setGroupIds] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [memberNicknames, setMemberNicknames] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState([]);
  const [showCall, setShowCall] = useState(false);
  const [calleeId, setCalleeId] = useState(null);
  const messagesEndRef = useRef(null);
  const { nickname, id, hideNickname, hideProfilePic } =
    useContext(UserContext);

  useEffect(() => {
    async function fetchNicknames() {
      const members = groupMembers.filter((m) => m.room_id === roomId);
      const nicknameMap = {};
      for (const m of members) {
        const result = await getNickname(m.user_id);
        nicknameMap[m.user_id] = result?.nickname || m.user_id;
      }
      setMemberNicknames(nicknameMap);
    }
    if (roomId && groupMembers.length > 0) fetchNicknames();
  }, [roomId, groupMembers]);

  // fetch the groups the user is a member of
  useEffect(() => {
    const fetchUserGroups = async () => {
      const { data, error } = await supabase
        .from("chat_room_members")
        .select("room_id")
        .eq("user_id", id);

      if (error) {
        console.log(`Error retrieving groups: ${error.message}`);
        return;
      }

      setGroupIds(data);
    };
    if (id) fetchUserGroups();
  }, [id]);

  // fetch group info
  useEffect(() => {
    const fetchGroups = async () => {
      const ids = groupIds.map((g) => g.room_id);

      if (ids.length === 0) {
        setGroups([]);
        return;
      }

      const { data, error } = await supabase
        .from("chat_rooms")
        .select("id, name")
        .in("id", ids);

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
  }, [groupIds]);

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

  // fetch group members
  useEffect(() => {
    const fetchGroupMembers = async () => {
      const ids = groupIds.map((g) => g.room_id);

      if (ids.length === 0) {
        setGroupMembers([]);
        return;
      }

      const { data, error } = await supabase
        .from("chat_room_members")
        .select("room_id, user_id")
        .in("room_id", ids);

      if (error) {
        console.log(`Error retrieving group members: ${error.message}`);
        return;
      }

      setGroupMembers(data);
    };

    if (groupIds.length > 0) fetchGroupMembers();
  }, [groupIds]);

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

  // Start a call with a selected member
  const handleStartCall = (userId) => {
    setCalleeId(userId);
    setShowCall(true);
  };

  return (
    <>
      <Tray nickname={nickname} />
      <div className="messages-page">
        {/* Chat group selector */}
        <div className="groups-panel">
          <div className="groups">
            <div
              className={`group ${selectedGroup === "🌐" ? "selected" : null}`}
              onClick={() => {
                setSelectedGroup("🌐");
                navigate(`/messages`);
              }}
            >
              <p className="group-name">🌐</p>
            </div>
            {groups.map((group) => {
              return (
                <div
                  className={`group ${selectedGroup === group.id ? "selected" : null}`}
                  disabled={selectedGroup === group.id ? true : false}
                  onClick={() => {
                    setSelectedGroup(`${group.id}`);
                    navigate(`/messages/${group.id}`);
                  }}
                >
                  <p className="group-name">{group.name}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Message List */}
        <div className="messages-list">
          <div className="messages">
            {messages.map((msg) => {
              const isCurrentUser = msg.user_id === id;
              const displayName =
                isCurrentUser && hideNickname ? "Anonymous" : msg.nickname;
              const displayAvatar =
                isCurrentUser && hideProfilePic
                  ? defaultAvatar
                  : msg.profile_pic_url || defaultAvatar;

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
                      {displayName} –{new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="message-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkEmoji]}
                      rehypePlugins={[
                        rehypeHighlight,
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
          </div>

          <div ref={messagesEndRef} />
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
        {roomId && (
          <div className="group-members-list">
            <h4>Members</h4>
            <ul>
              {groupMembers
                .filter((m) => m.room_id === roomId)
                .map((m) => (
                  <li key={m.user_id}>
                    <div className="user">
                      <Avatar otherUserId={m.user_id} />
                      <p>{`${memberNicknames[m.user_id]}#${m.user_id.slice(0, 6)}`}</p>
                      {m.user_id !== id && (
                        <button
                          style={{ marginLeft: 8 }}
                          onClick={() => handleStartCall(m.user_id)}
                        >
                          Start Call
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {/* Call Modal */}
        {showCall && calleeId && (
          <div className="call-modal">
            <CallPage callee={calleeId} onClose={() => setShowCall(false)} />
          </div>
        )}
      </div>
    </>
  );
};

export default Message;
