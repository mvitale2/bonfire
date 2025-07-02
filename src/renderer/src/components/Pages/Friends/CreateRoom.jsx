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
        nicknameMap[friend.public_id] = result?.nickname || "Unknown";
      }
      setNicknames(nicknameMap);
    }
    if (friends.length > 0) fetchNicknames();
  }, [friends]);

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
    <div className="friends-group-chat-wrapper">
      <h3>Create Group Chat</h3>
      <input
        type="text"
        placeholder="Room name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
      />
      <h4>Invite Friends</h4>
      <ul>
        {friends.map((friend) => {
          const nickname = nicknames[friend.public_id];
          const username = `${nickname}#${friend.public_id.slice(0, 6)}`;
          return (
            <li key={friend.public_id} className="friend-select">
              <label>
                <input
                  type="checkbox"
                  checked={selectedFriends.includes(friend.public_id)}
                  onChange={() => toggleFriend(friend.public_id)}
                />
                {username}
              </label>
            </li>
          );
        })}
      </ul>

      <button onClick={createGroupChat}>
        Create Room
      </button>
    </div>
  );
};

export default CreateRoom;
