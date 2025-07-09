import { UserContext } from "../../../UserContext.jsx";
import { useContext, useState, useEffect } from "react";
import "./Friends.css";
import Tray from "../../UI Components/Tray/Tray.jsx";
import supabase from "../../../../Supabase.jsx";
import Combobox from "react-widgets/Combobox";
import Avatar from "../../UI Components/Avatar/Avatar.jsx";
import CreateRoom from "./CreateRoom.jsx";

function Friends() {
  const { nickname, id } = useContext(UserContext);
  const [selectedSection, setSelectedSection] = useState("friends");

  const checkForRequest = async (otherId) => {
    const { data: sentRequests, error: sentError } = await supabase
      .from("friend_requests")
      .select("requesting_user_id, target_user_id")
      .eq("requesting_user_id", id);

    if (sentError) {
      console.log(`Error checking requests: ${error}`);
    }

    const { data: receivedRequests, error: receivedError } = await supabase
      .from("friend_requests")
      .select("requesting_user_id, target_user_id")
      .eq("target_user_id", id);

    if (receivedError) {
      console.log(`Error checking requests: ${error}`);
    }

    const found =
      (sentRequests &&
        sentRequests.some((req) => req.target_user_id === otherId)) ||
      (receivedRequests &&
        receivedRequests.some((req) => req.requesting_user_id === otherId));

    return !!found;
  };

  const checkIfFriend = async (targetId) => {
    const { data, error } = await supabase
      .from("users")
      .select("friends, public_id")
      .eq("public_id", id)
      .single();

    if (error) {
      console.log(`Error fetching friends: ${error.message}`);
      return false;
    } else if (data === null) {
      return false;
    } else {
      return data.friends.some((friend) => friend.public_id === targetId);
    }
  };

  function AddFriends() {
    const [input, setInput] = useState("");
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState();
    const [disableRequest, setDisableRequest] = useState(false);
    const [stateMsg, setStateMsg] = useState(null);

    const handleSendRequest = async () => {
      const { error } = await supabase.from("friend_requests").insert([
        {
          requesting_user_id: id,
          target_user_id: selectedUser.public_id,
        },
      ]);

      if (error) {
        console.log(`Error sending friend request: ${error}`);
      } else {
        setDisableRequest(true);
        setStateMsg("Friend request sent!");
        setTimeout(() => {
          setStateMsg(null);
        }, 5000);
      }
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
          <h3>Search for Users by Nickname</h3>
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
            onSelect={async (user) => {
              setSelectedUser(user);
              if (user.public_id === id) {
                setDisableRequest(true);
              } else {
                (async () => {
                  const alreadyRequested = await checkForRequest(
                    user.public_id
                  );
                  const alreadyFriend = await checkIfFriend(user.public_id);
                  setDisableRequest(alreadyRequested || alreadyFriend);
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
            <button
              className="request-btn"
              disabled={disableRequest}
              onClick={handleSendRequest}
            >
              Send Friend Request
            </button>
            {stateMsg ? <span className="state-msg">{stateMsg}</span> : null}
          </div>
        ) : null}
      </>
    );
  }

  function Requests() {
    const [friendRequests, setFriendRequests] = useState([]);
    const [nicknames, setNicknames] = useState({});

    const deleteRequest = async (targetId) => {
      const { delError } = await supabase
        .from("friend_requests")
        .delete()
        .eq("requesting_user_id", targetId)
        .eq("target_user_id", id);

      if (delError) {
        console.log(`Error deleting request: ${delError.message}`);
      }
    };

    const handleAccept = async (targetId) => {
      const newFriend = {
        public_id: targetId,
        since: new Date().toISOString(),
      };

      const currentUser = {
        public_id: id,
        since: new Date().toISOString(),
      };

      // Fetch the current friends array of the logged in user
      const { data: userFriends, error } = await supabase
        .from("users")
        .select("friends")
        .eq("public_id", id)
        .single();

      // Fetch the current friends array of the target user
      const { data: targetUserFriends, targetError } = await supabase
        .from("users")
        .select("friends")
        .eq("public_id", targetId)
        .single();

      if (!error && !targetError && userFriends && targetUserFriends) {
        const updatedFriends = Array.isArray(userFriends.friends)
          ? [...userFriends.friends, newFriend]
          : [newFriend];

        const updatedTargetFriends = Array.isArray(targetUserFriends.friends)
          ? [...targetUserFriends.friends, currentUser]
          : [currentUser];

        // Update the friends column of the logged in user with the new array
        const { error: updateError } = await supabase
          .from("users")
          .update({ friends: updatedFriends })
          .eq("public_id", id);

        if (updateError) {
          console.log("Error updating friends:", updateError.message);
        }

        // Update the friends column of the requesting user with the new array
        const { error: updateError1 } = await supabase
          .from("users")
          .update({ friends: updatedTargetFriends })
          .eq("public_id", targetId);

        if (updateError1) {
          console.log("Error updating friends:", updateError1.message);
        }
      }

      await deleteRequest(targetId);
    };

    const handleDecline = async (targetId) => {
      await deleteRequest(targetId);
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
          { event: "*", schema: "public", table: "friend_requests" },
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
                <button
                  className="accept"
                  onClick={() => handleAccept(req.requesting_user_id)}
                >
                  Accept
                </button>
                <button
                  className="decline"
                  onClick={() => {
                    handleDecline(req.requesting_user_id);
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div>You have no pending requests.</div>
    );
  }

  function Friends() {
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleRemoveFriend = async (targetId) => {
      const { data: friends, error } = await supabase
        .from("users")
        .select("friends")
        .eq("public_id", id)
        .single();

      if (error) {
        console.log(`Error retrieving friends: ${error.message}`);
        return;
      }

      const updatedFriends = Array.isArray(friends.friends)
        ? friends.friends.filter((f) => f.public_id !== targetId)
        : [];

      const { error: updateError } = await supabase
        .from("users")
        .update({ friends: updatedFriends })
        .eq("public_id", id);

      if (updateError) {
        console.log(`Error updating friends: ${updateError.message}`);
      }

      const { data: targetFriends } = await supabase
        .from("users")
        .select("friends")
        .eq("public_id", targetId)
        .single();

      const updatedTargetFriends = Array.isArray(targetFriends.friends)
        ? targetFriends.friends.filter((f) => f.public_id !== id)
        : [];

      await supabase
        .from("users")
        .update({ friends: updatedTargetFriends })
        .eq("public_id", targetId);
    };

    useEffect(() => {
      const fetchFriends = async () => {
        const { data, error } = await supabase
          .from("users")
          .select("friends")
          .eq("public_id", id)
          .single();

        if (error) {
          console.log(error.message);
          setFriends([]);
          setLoading(false);
          return;
        }

        const friendIds = Array.isArray(data?.friends)
          ? data.friends.map((f) => f.public_id)
          : [];

        if (friendIds.length === 0) {
          setFriends([]);
          setLoading(false);
          return;
        }

        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("public_id, nickname, last_logon")
          .in("public_id", friendIds);

        if (usersError || !users) {
          setFriends([]);
          setLoading(false);
          return;
        }

        const friendsWithNicknames = data.friends.map((friend) => {
          let username;
          let lastLogon;
          users.forEach((u) => {
            if (u.public_id === friend.public_id) {
              username = `${u.nickname}#${u.public_id.slice(0, 6)}`;
              lastLogon = u.last_logon;
            }
          });
          return {
            ...friend,
            nickname: username,
            lastLogon: lastLogon,
          };
        });

        setFriends(friendsWithNicknames);
        setLoading(false);
      };

      fetchFriends();

      const channel = supabase
        .channel("friends-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "users" },
          (payload) => {
            fetchFriends();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, []);

    return (
      <div className="friends-list-wrapper">
        {friends.length === 0 ? (
          loading ? (
            <div>Loading...</div>
          ) : (
            <div>You have no friends!</div>
          )
        ) : (
          friends.map((friend) => {
            return (
              <div className="friend" key={friend.public_id}>
                <Avatar otherUserId={friend.public_id} />
                <span>{friend.nickname}</span>
                <span>{`Last online: ${friend.lastLogon}`}</span>
                <button
                  className="unfriend-btn"
                  onClick={() => handleRemoveFriend(friend.public_id)}
                >
                  Remove Friend
                </button>
              </div>
            );
          })
        )}
      </div>
    );
  }

  const renderContent = () => {
    switch (selectedSection) {
      case "friends":
        return <Friends />;
      case "add":
        return <AddFriends />;
      case "requests":
        return <Requests />;
      case "create":
        return <CreateRoom />;
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
            <li
              className={selectedSection === "create" ? "active" : ""}
              onClick={() => setSelectedSection("create")}
            >
              Create Group Chat
            </li>
          </ul>
        </div>
        <div className="right">{renderContent()}</div>
      </div>
    </>
  );
}

export default Friends;
