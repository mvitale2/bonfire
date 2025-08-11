import { useState, useEffect, useRef, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../../../UserContext.jsx";
import supabase from "../../../../Supabase.jsx";
import "./message.css";
import Tray from "../../UI Components/Tray/Tray.jsx";
import { IoSend } from "react-icons/io5";
import { IoMdAdd } from "react-icons/io";
import { MdCall, MdDelete, MdCancel } from "react-icons/md";
import { FaEdit } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import defaultAvatar from "../../../assets/default_avatar.png";
import remarkEmoji from "remark-emoji";
import getNickname from "../../../getNickname.jsx";
import Avatar from "../../UI Components/Avatar/Avatar.jsx";
import rehypeHighlight from "rehype-highlight";
import {
  decryptMessage,
  retrievePrivateKey,
  decryptGroupKey,
  encryptMessage,
} from "../../../Crypto.jsx";
import fetchProfilePicture from "../../../fetchProfilePicture.jsx";

const Message = () => {
  const { roomId } = useParams();
  const { inCall, setInCall, setRemoteUserId } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isPopup = params.get("popup") === "1";

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [refreshMessages, setRefreshMessages] = useState(0);
  const [isEditing, setIsEditing] = useState({
    editing: false,
    messageId: null,
    imageUrl: null,
  });

  const [groupIds, setGroupIds] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [memberNicknames, setMemberNicknames] = useState({});
  const [selectedGroup, setSelectedGroup] = useState("");
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

  // Fetch member nicknames for display
  useEffect(() => {
    async function fetchNicknames() {
      const members = groupMembers.filter((m) => m.room_id === roomId);
      const nicknameMap = {};
      for (const m of members) {
        const nick = await getNickname(m.user_id);
        nicknameMap[m.user_id] = nick;
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

  useEffect(() => {
    async function getUserGroupNamesAndSetFirst(userId) {
      const { data, error } = await supabase
        .from("chat_room_members")
        .select("room_id, chat_rooms(name)")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching group names:", error.message);
        return [];
      }

      const groupsArr = data.map((item) => ({
        room_id: item.room_id,
        name: item.chat_rooms?.name || "",
      }));

      if (groupsArr.length > 0) {
        setSelectedGroup(groupsArr[0].room_id);
        // navigate(`/messages/${groupsArr[0].room_id}`);
      }

      return groupsArr;
    }

    getUserGroupNamesAndSetFirst(id);
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
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      const { data, error } = roomId
        ? await query.eq("room_id", roomId)
        : await query.is("room_id", null);

      if (error) {
        console.log(`Error fetching messages: ${error.message}`);
        return;
      }

      const { data: roomData, error: roomError } = await supabase
        .from("chat_rooms")
        .select("keys")
        .eq("id", roomId)
        .single();

      // console.log(roomId)

      if (roomError) {
        console.log(`Error retrieving group keys: ${roomError.message}`);
        setMessages([]);
        return;
      }

      const encryptedGroupKeys =
        typeof roomData.keys === "string"
          ? JSON.parse(roomData.keys)
          : roomData.keys;
      const encryptedUserKey = encryptedGroupKeys[id];
      const encryptedGroupKeyBuffer = Uint8Array.from(
        atob(encryptedUserKey),
        (c) => c.charCodeAt(0)
      );
      const privateKey = await retrievePrivateKey(id);
      const groupKey = await decryptGroupKey(
        encryptedGroupKeyBuffer,
        privateKey
      );

      const decryptedMessages = await Promise.all(
        data.map(async (msg) => {
          let decryptedContent = "";
          // console.log(msg.content);
          try {
            decryptedContent = await decryptMessage(
              msg.content,
              msg.iv,
              groupKey
            );
          } catch (e) {
            console.log(e);
            decryptedContent = "Unable to decrypt";
          }

          let decryptedImageUrl = null;
          if (msg.image_url && msg.image_iv) {
            try {
              const response = await fetch(msg.image_url);
              const encryptedImageBuffer = await response.arrayBuffer();

              const imageIv = Uint8Array.from(atob(msg.image_iv), (c) =>
                c.charCodeAt(0)
              );

              const decryptedImageBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: imageIv },
                groupKey,
                encryptedImageBuffer
              );

              const blob = new Blob([decryptedImageBuffer]);
              decryptedImageUrl = URL.createObjectURL(blob);
            } catch (e) {
              decryptedImageUrl = null;
            }
          }

          const nickname = await getNickname(msg.user_id);
          const pfp = await fetchProfilePicture(msg.user_id);

          return {
            ...msg,
            content: decryptedContent,
            decryptedImageUrl,
            nickname,
            pfp,
          };
        })
      );

      setMessages(decryptedMessages);
    };

    const deleteChannel = supabase
      .channel("delete-messages")
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        () => {
          // console.log("a message was deleted!");
          fetchMessages();
        }
      )
      .subscribe();

    const editChannel = supabase
      .channel("edit-messages")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          // console.log("a messages was edited");
          fetchMessages();
        }
      )
      .subscribe();

    fetchMessages();

    return () => {
      supabase.removeChannel(deleteChannel);
      supabase.removeChannel(editChannel);
    };
  }, [roomId, refreshMessages, selectedGroup]);

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

  // Realtime updates: track new messages & unread counts
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
            // setMessages((prev) => [...prev, data]);
            setRefreshMessages(refreshMessages + 1);
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

  const handleCall = (targetId) => {
    // console.log(`Target friend: ${targetId}`)
    setRemoteUserId(targetId);
    setInCall(true);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !imageFile) return;
    if (!id) return alert("User ID is missing.");

    // retrieve the user's group key for encryption
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("keys")
      .eq("id", roomId)
      .single();

    if (error) {
      console.log(`Error retrieving group keys: ${error.message}`);
      return;
    }

    const encryptedGroupKeys =
      typeof data.keys === "string" ? JSON.parse(data.keys) : data.keys;
    const encryptedUserKey = encryptedGroupKeys[id];
    const encryptedGroupKeyBuffer = Uint8Array.from(
      atob(encryptedUserKey),
      (c) => c.charCodeAt(0)
    );
    const privateKey = await retrievePrivateKey(id);
    const decryptedGroupKey = await decryptGroupKey(
      encryptedGroupKeyBuffer,
      privateKey
    );

    let imageUrl = null;
    let imageIv = null;

    if (imageFile) {
      const fileBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(imageFile);
      });

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        decryptedGroupKey,
        fileBuffer
      );

      const fileExt = imageFile.name.split(".").pop();
      const filePath = `public/${Date.now()}.${fileExt}`;
      const encryptedBlob = new Blob([encryptedBuffer]);

      const { error: uploadError } = await supabase.storage
        .from("message-images")
        .upload(filePath, encryptedBlob);

      if (uploadError) {
        console.error("Error uploading image:", uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("message-images")
        .getPublicUrl(filePath);

      imageUrl = urlData?.publicUrl || null;
      imageIv = btoa(String.fromCharCode(...iv));
    }

    if (isEditing.editing === true) {
      // Behavior for editing a message
      const ciphertext = await encryptMessage(newMessage, decryptedGroupKey);
      let imageUrl = isEditing.originalImageUrl;
      let imageIv = isEditing.originalImageIv;

      if (imageFile) {
        const fileBuffer = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(imageFile);
        });

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedBuffer = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          decryptedGroupKey,
          fileBuffer
        );

        const fileExt = imageFile.name.split(".").pop();
        const filePath = `public/${Date.now()}.${fileExt}`;
        const encryptedBlob = new Blob([encryptedBuffer]);

        const { error: uploadError } = await supabase.storage
          .from("message-images")
          .upload(filePath, encryptedBlob);

        if (uploadError) {
          console.error("Error uploading image:", uploadError.message);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("message-images")
          .getPublicUrl(filePath);

        imageUrl = urlData?.publicUrl || null;
        imageIv = btoa(String.fromCharCode(...iv));
      }

      const { error } = await supabase
        .from("messages")
        .update({
          content: ciphertext.ciphertext,
          image_url: imageUrl,
          iv: ciphertext.iv,
          image_iv: imageIv,
        })
        .eq("id", isEditing.messageId);

      if (error) {
        console.log(`Error updating message: ${error.message}`);
      } else {
        setNewMessage("");
        setImageFile(null);
        setIsEditing({ editing: false, messageId: null, imageUrl: null });
      }
    } else {
      // Normal behavior for sending a message
      const ciphertext = await encryptMessage(newMessage, decryptedGroupKey);
      // console.log(`Encrypted message: ${ciphertext.ciphertext}`);
      const { error } = await supabase.from("messages").insert([
        {
          content: ciphertext.ciphertext,
          user_id: id,
          room_id: roomId || null,
          image_url: imageUrl,
          iv: ciphertext.iv,
          image_iv: imageIv,
        },
      ]);

      if (error) {
        console.error("Error sending message:", error.message);
      } else {
        setNewMessage("");
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteMessage = async (msgId) => {
    const { error } = await supabase.from("messages").delete().eq("id", msgId);

    if (error) console.log(`Error deleting message: ${error.message}`);
  };

  const handleEditMessage = async (msgId) => {
    setIsEditing({
      editing: true,
      messageId: msgId,
      imageUrl: null,
    });

    const { data, error } = await supabase
      .from("messages")
      .select("content, iv, image_url, image_iv")
      .eq("id", msgId)
      .single();

    if (error) {
      console.log(`Error retriving encrypted message: ${error.message}`);
      return;
    }

    const { data: roomData, error: roomError } = await supabase
      .from("chat_rooms")
      .select("keys")
      .eq("id", roomId)
      .single();

    if (roomError) {
      console.log(`Error retrieving group keys: ${roomError.message}`);
      return;
    }

    const encryptedGroupKeys =
      typeof roomData.keys === "string"
        ? JSON.parse(roomData.keys)
        : roomData.keys;
    const encryptedUserKey = encryptedGroupKeys[id];
    const encryptedGroupKeyBuffer = Uint8Array.from(
      atob(encryptedUserKey),
      (c) => c.charCodeAt(0)
    );
    const privateKey = await retrievePrivateKey(id);
    const groupKey = await decryptGroupKey(encryptedGroupKeyBuffer, privateKey);
    const plaintext = await decryptMessage(data.content, data.iv, groupKey);

    let decryptedImageUrl = null;
    if (data.image_url && data.image_iv) {
      try {
        const response = await fetch(data.image_url);
        const encryptedImageBuffer = await response.arrayBuffer();

        const imageIv = Uint8Array.from(atob(data.image_iv), (c) =>
          c.charCodeAt(0)
        );

        const decryptedImageBuffer = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: imageIv },
          groupKey,
          encryptedImageBuffer
        );

        const blob = new Blob([decryptedImageBuffer]);
        decryptedImageUrl = URL.createObjectURL(blob);
      } catch (e) {
        console.log(e);
        decryptedImageUrl = null;
      }
    }

    setNewMessage(plaintext);
    setImageFile(null);
    setIsEditing((prev) => ({
      ...prev,
      imageUrl: decryptedImageUrl || null,
      originalImageUrl: data.image_url || null,
      originalImageIv: data.image_iv || null,
    }));
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
              {/* <div
                className={`group ${selectedGroup === "🌐" ? "selected" : ""}`}
                onClick={() => {
                  setSelectedGroup("🌐");
                  navigate(`/messages`);
                }}
              >
                <p className="group-name">🌐</p>
              </div> */}
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
              const messageId = msg.message_id || msg.id;
              const isCurrentUser = msg.user_id === id;
              const displayName =
                isCurrentUser && hideNickname
                  ? "Anonymous"
                  : `${msg.nickname}#${msg.user_id.slice(0, 6)}`;
              const displayAvatar =
                isCurrentUser && hideProfilePic
                  ? defaultAvatar
                  : msg.pfp || defaultAvatar;

              return (
                <div key={messageId} className="message">
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
                    <div className="message-header">
                      <span className="display-name">{displayName}</span>
                      <span className="time">
                        {new Date(msg.created_at).toLocaleDateString()}{" "}
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                      {msg.user_id === id ? (
                        <div className="message-actions">
                          <div
                            className="edit-btn"
                            onClick={async () => {
                              await handleEditMessage(messageId);
                            }}
                          >
                            <FaEdit />
                          </div>
                          <div
                            className="delete-btn"
                            onClick={async () =>
                              await handleDeleteMessage(messageId)
                            }
                          >
                            <MdDelete />
                          </div>
                        </div>
                      ) : null}
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
                            src={msg.decryptedImageUrl || msg.image_url}
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
                <IoMdAdd />
              </label>
              {isEditing.editing ? (
                <div
                  className="edit-cancel-btn"
                  onClick={() => {
                    setIsEditing({ editing: false, messageId: null });
                    setNewMessage("");
                  }}
                >
                  <MdCancel />
                </div>
              ) : null}
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className={`message-input ${isEditing.editing ? "editing" : null}`}
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
            {(imageFile || isEditing.imageUrl) && (
              <div className="selected-file">
                {imageFile ? (
                  <span>{imageFile.name}</span>
                ) : (
                  <>
                    <img
                      src={isEditing.imageUrl}
                      alt="current"
                      style={{ maxWidth: 100, maxHeight: 100 }}
                    />
                    <span>Current image</span>
                  </>
                )}
                <button
                  onClick={() => {
                    setImageFile(null);
                    setIsEditing((prev) => ({ ...prev, imageUrl: null }));
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Group members panel */}
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
                      {/* <p>{`#${m.user_id.slice(0, 6)}`}</p> */}
                      {m.user_id === id ? null : (
                        <div className="call-btn-div">
                          <button
                            className="call-btn"
                            onClick={() => handleCall(m.user_id)}
                            disabled={inCall}
                          >
                            <MdCall />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
};
export default Message;
