import { useState, useEffect, useRef, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import CallPage from "../webrtc/callpage.jsx";

const Message = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isPopup = params.get("popup") === "1";

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const [groupIds, setGroupIds] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [memberNicknames, setMemberNicknames] = useState({});
  const [selectedGroup, setSelectedGroup] = useState("🌐");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  const { nickname, id, hideNickname, hideProfilePic } =
    useContext(UserContext);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Call state
  const [callCtx, setCallCtx] = useState(null);

  // Fetch member nicknames for display
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

      if (!error) {
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

  // Realtime updates: track unread counts
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

          if (!error && data) {
            setMessages((prev) => [...prev, data]);
            // Only increment if the message is NOT from the current user and NOT in the currently viewed group
            if (data.user_id !== id && data.room_id !== roomId) {
              setUnreadCounts((prev) => ({
                ...prev,
                [data.room_id]: (prev[data.room_id] || 0) + 1,
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, id]);

  // Reset unread count when user views a group
  useEffect(() => {
    if (roomId) {
      setUnreadCounts((prev) => ({
        ...prev,
        [roomId]: 0,
      }));
    }
  }, [roomId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !imageFile) return;
    if (!id) return alert("User ID is missing.");

    let imageUrl = null;

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `public/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("message-images")
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error("Error uploading image:", uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("message-images")
        .getPublicUrl(filePath);

      imageUrl = urlData?.publicUrl || null;
    }

    const { error } = await supabase.from("messages").insert([
      {
        content: newMessage,
        user_id: id,
        room_id: roomId || null,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      console.error("Error sending message:", error.message);
    } else {
      setNewMessage("");
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Start a call with a selected member
  const handleStartCall = async (peerId) => {
    // Create or find a DM room for this pair
    const roomName = [`dm`, id.slice(0, 4), peerId.slice(0, 4)]
      .sort()
      .join("-");
    const { data: existing } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("name", roomName)
      .maybeSingle();

    let dmRoomId = existing?.id;
    if (!dmRoomId) {
      const { data } = await supabase
        .from("chat_rooms")
        .insert({ name: roomName, creator_user_id: id })
        .select()
        .single();
      dmRoomId = data.id;
    }
    setCallCtx({ roomId: dmRoomId, peerId, audioOnly: true });
  };

  // Calculate total unread messages for all groups
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      {!isPopup && <Tray nickname={nickname} unreadCount={totalUnread} />}
      <div className="messages-page">
        {!isPopup && (
          <div className="groups-panel">
            <div className="groups">
              <div
                className={`group ${selectedGroup === "🌐" ? "selected" : ""}`}
                onClick={() => {
                  setSelectedGroup("🌐");
                  navigate(`/messages`);
                }}
              >
                <p className="group-name">🌐</p>
              </div>
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`group ${selectedGroup === group.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedGroup(`${group.id}`);
                    navigate(`/messages/${group.id}`);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    window.electron?.ipcRenderer?.send(
                      "open-group-window",
                      group.id
                    );
                  }}
                >
                  <p className="group-name">{group.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Message List */}
        <div className="messages-list">
          <div className="messages">
            {messages.map((msg) => {
              const isCurrentUser = msg.user_id === id;
              const displayName =
                isCurrentUser && hideNickname
                  ? "Anonymous"
                  : `${msg.nickname}#${msg.user_id.slice(0, 6)}`;
              const displayAvatar =
                isCurrentUser && hideProfilePic
                  ? defaultAvatar
                  : msg.profile_pic_url || defaultAvatar;

              return (
                <div key={msg.message_id || msg.id} className="message">
                  <div className="message-left">
                    <img
                      src={displayAvatar}
                      alt="avatar"
                      className="avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = defaultAvatar;
                      }}
                    />
                  </div>
                  <div className="message-right">
                    <div className="message-time">
                      <span className="display-name">{displayName}</span>
                      <span className="time">
                        {new Date(msg.created_at).toLocaleDateString()}{" "}
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
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
                      {msg.image_url && (
                        <>
                          <img
                            src={msg.image_url}
                            alt="attachment"
                            className="sent-image"
                            style={{
                              maxWidth: "300px",
                              borderRadius: "8px",
                              marginTop: "8px",
                            }}
                            onLoad={scrollToBottom}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="message-input-container">
            <div className="input-with-button">
              <label className="file-label">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                  style={{ display: "none" }}
                />
                📎
              </label>
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="message-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (newMessage.trim() || imageFile)) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                onFocus={() => {
                  if (roomId) {
                    setUnreadCounts((prev) => ({
                      ...prev,
                      [roomId]: 0,
                    }));
                  }
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() && !imageFile}
              >
                <IoSend />
              </button>
            </div>
            {imageFile && (
              <div className="selected-file">
                <span>{imageFile.name}</span>
                <button onClick={() => setImageFile(null)}>Remove</button>
              </div>
            )}
          </div>

          {/* Members */}
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
                        <span>{memberNicknames[m.user_id] || m.user_id}</span>
                        <span>#{m.user_id.slice(0, 6)}</span>
                        {m.user_id !== id && (
                          <button onClick={() => handleStartCall(m.user_id)}>
                            📞
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Call Modal */}
          {callCtx && (
            <div className="call-modal">
              <CallPage
                callee={callCtx.peerId}
                roomId={callCtx.roomId}
                audioOnly={true}
                onClose={() => setCallCtx(null)}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Message;
