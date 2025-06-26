import { UserContext } from "../../../UserContext.jsx";
import { useContext, useState } from "react";
import "./Friends.css";
import Tray from "../../UI Components/Tray/Tray.jsx";
import CreateRoom from "./CreateRoom.jsx"; // ✅ import your new component

function Friends() {
  const { nickname } = useContext(UserContext);
  const [selectedSection, setSelectedSection] = useState("friends"); // Default section

  const renderContent = () => {
    switch (selectedSection) {
      case "friends":
        return <div>Friends list</div>;
      case "add":
        return <div>Add friends</div>;
      case "create":
        return <CreateRoom />; // ✅ this is the new section
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
