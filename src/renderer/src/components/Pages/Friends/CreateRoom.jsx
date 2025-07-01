import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../../../../Supabase.jsx";
import { UserContext } from "../../../UserContext.jsx";

const CreateRoom = () => {
  const { id: userId } = useContext(UserContext);
  const [roomName, setRoomName] = useState("");
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const navigate = useNavigate();

  // Fetch user's friends
  useEffect(() => {
    const fetchFriends = async () => {
      if (!userId || userId.length !== 36) {
        console.error("Invalid or missing user ID");
        return;
      }

      const { data, error } = await supabase
        .from("friend_requests")
        .select("target_user_id, requesting_user_id")
        .or(`target_user_id.eq.${userId},requesting_user_id.eq.${userId}`);

      if (error) {
        console.error("Error loading friends:", error);
        return;
      }

      const friendIds = data
        .map((r) =>
          r.target_user_id === userId ? r.requesting_user_id : r.target_user_id
        )
        .filter(Boolean);

      const { data: friendUsers } = await supabase
        .from("users")
        .select("public_id, nickname")
        .in("public_id", friendIds);

      setFriends(friendUsers || []);
    };

    fetchFriends();
  }, [userId]);

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
      alert("Group chat created!");
      navigate(`/messages/${room.id}`);
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h3>Create Group Chat</h3>
      <input
        type="text"
        placeholder="Room name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        style={{ padding: "0.5rem", width: "100%", marginBottom: "1rem" }}
      />

      <h4>Invite Friends</h4>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {friends.map((friend) => (
          <li key={friend.public_id}>
            <label>
              <input
                type="checkbox"
                checked={selectedFriends.includes(friend.public_id)}
                onChange={() => toggleFriend(friend.public_id)}
              />
              {" "}{friend.nickname}
            </label>
          </li>
        ))}
      </ul>

      <button onClick={createGroupChat} style={{ marginTop: "1rem" }}>
        Create Room
      </button>
    </div>
  );
};

export default CreateRoom;
