import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../../../../Supabase.jsx";
import { UserContext } from "../../../UserContext.jsx";
import getFriends from "../../../getFriends.jsx";
import getNickname from "../../../getNickname.jsx";

const CreateRoom = () => {
  const { id: userId } = useContext(UserContext);
  const [roomName, setRoomName] = useState("");
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [nicknames, setNicknames] = useState({});
  const [rooms, setRooms] = useState([]);
  const [loadingRoomId, setLoadingRoomId] = useState(null); // <-- Spinner state
  const navigate = useNavigate();

  // Fetch user's friends
  useEffect(() => {
    async function fetchFriends() {
      const retrievedFriends = await getFriends(userId);
      setFriends(retrievedFriends);
    }
    fetchFriends();
  }, [userId]);

  useEffect(() => {
    async function fetchNicknames() {
      const nicknameMap = {};
      for (const friend of friends) {
        const result = await getNickname(friend.public_id);
        nicknameMap[friend.public_id] = result || "Unknown";
      }
      setNicknames(nicknameMap);
    }
    if (friends.length > 0) fetchNicknames();
  }, [friends]);

  // Fetch rooms and subscribe to realtime changes
  useEffect(() => {
    let channel;
    async function fetchRooms() {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("creator_user_id", userId);

      if (!error && data) setRooms(data);
    }
    fetchRooms();

    channel = supabase
      .channel("chat-rooms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_rooms" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRooms((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setRooms((prev) =>
              prev.map((room) =>
                room.id === payload.new.id ? payload.new : room
              )
            );
          } else if (payload.eventType === "DELETE") {
            setRooms((prev) =>
              prev.filter((room) => room.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  // Watch for the new room to appear in rooms, then navigate
  useEffect(() => {
    if (loadingRoomId && rooms.some((room) => room.id === loadingRoomId)) {
      // Room is now in the list, safe to navigate
      setLoadingRoomId(null);
      navigate(`/messages/${loadingRoomId}`);
    }
  }, [rooms, loadingRoomId, navigate]);

  const toggleFriend = (id) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const createGroupChat = async () => {
    if (!roomName.trim()) return alert("Room name is required.");
    if (!userId || userId.length !== 36) {
      alert("User ID is invalid or missing.");
      return;
    }

    // Create the room
    const { data: room, error: roomErr } = await supabase
      .from("chat_rooms")
      .insert({ name: roomName, creator_user_id: userId })
      .select()
      .single();

    if (roomErr) {
      console.error("Failed to create room:", roomErr);
      return;
    }

    // Add selected friends + self as members
    const members = [...selectedFriends, userId].map((id) => ({
      room_id: room.id,
      user_id: id,
    }));

    const { error: memberErr } = await supabase
      .from("chat_room_members")
      .insert(members);

    if (memberErr) {
      console.error("Failed to add members:", memberErr);
    } else {
      setLoadingRoomId(room.id); // Show spinner and wait for realtime update
    }
  };

  return (
    <div className="friends-group-chat-wrapper">
      <h3>Create Group Chat</h3>
      <input
        type="text"
        placeholder="Room name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        disabled={!!loadingRoomId}
      />
      <h4>Invite Friends</h4>
      <ul>
        {friends.map((friend) => {
          const nickname = nicknames[friend.public_id];
          const username = `${nickname}#${friend.public_id.slice(0, 6)}`;
          return (
            <li key={friend.public_id} className="friend-select">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedFriends.includes(friend.public_id)}
                  onChange={() => toggleFriend(friend.public_id)}
                  disabled={!!loadingRoomId}
                />
                {username}
              </label>
            </li>
          );
        })}
      </ul>
      <button onClick={createGroupChat} disabled={!!loadingRoomId}>
        {loadingRoomId ? "Creating..." : "Create Room"}
      </button>
      {loadingRoomId && (
        <div style={{ margin: "1em 0", textAlign: "center" }}>
          <span className="spinner" />
          <span style={{ marginLeft: 8 }}>Waiting for room to appear...</span>
        </div>
      )}
      <h4>Your Rooms</h4>
      <div className="rooms-list-scroll">
        <ul>
          {rooms.map((room) => (
            <li key={room.id}>{room.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CreateRoom;
