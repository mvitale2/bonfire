import { UserContext } from "../../../UserContext.jsx";
import { useContext, useState, useEffect } from "react";
import "./Friends.css";
import Tray from "../../UI Components/Tray/Tray.jsx";
import supabase from "../../../../Supabase.jsx";
import Combobox from "react-widgets/Combobox";
import Avatar from "../../UI Components/Avatar/Avatar.jsx";

function Friends() {
  const { nickname, id } = useContext(UserContext);
  const [selectedSection, setSelectedSection] = useState("friends");

  function AddFriends() {
    const [input, setInput] = useState("");
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState();
    const [disableRequest, setDisableRequest] = useState(false);

    const handleSendRequest = async () => {
      const { error } = await supabase.from("friend_requests").insert([
        {
          requesting_user_id: id,
          target_user_id: selectedUser.public_id,
        },
      ]);

      if (error) {
        console.log(`Error sending friend request: ${error}`);
      }
    };

    const checkForRequest = async (otherId) => {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("requesting_user_id, target_user_id")
        .eq("requesting_user_id", id);

      if (error) {
        console.log(`Error checking requests: ${error}`);
      }

      const found = data && data.some((req) => req.target_user_id === otherId);
      return found;
    };

    useEffect(() => {
      if (!input) return;

      const fetchUsers = async () => {
        const { data, error } = await supabase
          .from("users")
          .select("nickname, public_id")
          .ilike("nickname", `%${input}%`);

        if (error) {
          console.log(`Error occured while fetching users: ${error}`);
        }

        setUsers(data || []);
      };

      fetchUsers();
    }, [input]);

    return (
      <>
        <div className="search">
          <Combobox
            data={users}
            hideCaret
            textField={(user) =>
              typeof user === "object" &&
              user !== null &&
              user.nickname &&
              user.public_id
                ? `${user.nickname}#${user.public_id.slice(0, 6)}`
                : user || ""
            }
            onChange={(value) => setInput(value)}
            onSelect={(user) => {
              setSelectedUser(user);
              if (user.public_id === id) {
                setDisableRequest(true);
              } else {
                (async () => {
                  const alreadyRequested = await checkForRequest(
                    user.public_id
                  );
                  setDisableRequest(alreadyRequested);
                })();
              }
            }}
            messages={{
              emptyList: "No users match your search.",
              emptyFilter: "No users match your search.",
            }}
          />
        </div>

        {selectedUser ? (
          <div className="selected-user-wrapper">
            <Avatar otherUserId={selectedUser.public_id} />
            <div>
              {`${selectedUser.nickname}#${selectedUser.public_id.slice(0, 6)}`}
            </div>
            {/* disabled ternary operator in order to disallow sending friend requests to oneself */}
            <button
              className="request-btn"
              disabled={disableRequest}
              onClick={handleSendRequest}
            >
              Send Friend Request
            </button>
          </div>
        ) : null}
      </>
    );
  }

  function Requests() {
    const [friendRequests, setFriendRequests] = useState([]);
    const [nicknames, setNicknames] = useState({});

    const fetchNickname = async (public_id) => {
      const { data, error } = await supabase
        .from("users")
        .select("public_id, nickname")
        .eq("public_id", public_id);

      if (error) {
        console.log(`Error occurred while fetching nickname: ${error.message}`);
      } else {
        return data;
      }
    };

    useEffect(() => {
      const fetchRequests = async () => {
        const { data, error } = await supabase
          .from("friend_requests")
          .select("requesting_user_id, target_user_id")
          .eq("target_user_id", id);

        if (error) {
          console.log(`Error checking requests: ${error.message}`);
          setFriendRequests([]);
          setNicknames({});
        } else {
          setFriendRequests(data || []);
          const userIds = (data || []).map((req) => req.requesting_user_id);
          if (userIds.length > 0) {
            const { data: users, error: userError } = await supabase
              .from("users")
              .select("public_id, nickname")
              .in("public_id", userIds);
            if (!userError && users) {
              const nicknameMap = {};
              users.forEach((user) => {
                nicknameMap[user.public_id] = user.nickname;
              });
              setNicknames(nicknameMap);
            }
          }
        }
      };

      fetchRequests();

      const channel = supabase
        .channel("friend-requests-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friend-requests" },
          (payload) => {
            fetchRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [id]);

    return friendRequests.length > 0 ? (
      <div className="friend-requests-wrapper">
        <h3>Pending Requests</h3>
        {friendRequests.map((req) => {
          return (
            <div className="friend-request" key={req.requesting_user_id}>
              <span>{nicknames[req.requesting_user_id] || "Loading..."}</span>
              <Avatar otherUserId={req.requesting_user_id} />
              <div className="buttons">
                <button className="accept">Accept</button>
                <button className="decline">Decline</button>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div>You have no pending requests.</div>
    );
  }

  const renderContent = () => {
    switch (selectedSection) {
      case "friends":
        return <div>Friends</div>;
      case "add":
        return <AddFriends />;
      case "requests":
        return <Requests />;
      default:
        return <div>Select a section to view settings</div>;
    }
  };

  return (
    <>
      <Tray nickname={nickname} />
      <div className="friends-wrapper">
        <div className="left">
          <ul>
            <li
              className={selectedSection === "friends" ? "active" : ""}
              onClick={() => setSelectedSection("friends")}
            >
              Friends
            </li>
            <li
              className={selectedSection === "add" ? "active" : ""}
              onClick={() => setSelectedSection("add")}
            >
              Add Friends
            </li>
            <li
              className={selectedSection === "requests" ? "active" : ""}
              onClick={() => setSelectedSection("requests")}
            >
              Friend Requests
            </li>
          </ul>
        </div>
        <div className="right">{renderContent()}</div>
      </div>
    </>
  );
}

export default Friends;
