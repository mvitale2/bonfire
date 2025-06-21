import { UserContext } from "../../../UserContext.jsx";
import { useContext, useState, useEffect } from "react";
import "./Friends.css";
import Tray from "../../UI Components/Tray/Tray.jsx";
import supabase from "../../../../Supabase.jsx";
import Combobox from "react-widgets/Combobox";
import Avatar from "../../UI Components/Avatar/Avatar.jsx";

function Friends() {
  const { nickname } = useContext(UserContext);
  const [selectedSection, setSelectedSection] = useState("friends");

  function AddFriends() {
    const [input, setInput] = useState("");
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState();

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
            <button>Send Friend Request</button>
          </div>
        ) : null}
      </>
    );
  }

  const renderContent = () => {
    switch (selectedSection) {
      case "friends":
        return <div>Friends</div>;
      case "add":
        return <AddFriends />;
      case "requests":
        return <div>Requests</div>;
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
