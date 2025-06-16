import { UserContext } from "../../../UserContext.jsx";
import { useContext, useState } from "react";
import "./Friends.css";
import Tray from "../../UI Components/Tray/Tray.jsx";

function Friends() {
  const { nickname } = useContext(UserContext);
  const [selectedSection, setSelectedSection] = useState("friends"); // Default section

  const renderContent = () => {
    switch (selectedSection) {
      case "friends":
        return <div>Friends list</div>;
      case "add":
        return <div>Add friends</div>;
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
              className={selectedSection === "add friends" ? "active" : ""}
              onClick={() => setSelectedSection("add")}
            >
              Add Friends
            </li>
          </ul>
        </div>
        <div className="right">{renderContent()}</div>
      </div>
    </>
  );
}

export default Friends;
