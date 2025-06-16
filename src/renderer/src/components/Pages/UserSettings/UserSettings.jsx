import MessagePage from "../Message/Message.jsx";
import { useNavigate } from "react-router-dom";
import { useState, useContext } from "react";
import "./UserSettings.css";
import { UserContext } from "../../../UserContext.jsx";
import supabase from "../../../../Supabase.jsx";
import Tray from "../../UI Components/Tray/Tray";

function UserSettings() {
  const [selectedSection, setSelectedSection] = useState("profile"); // Default section
  const { nickname } = useContext(UserContext);
  const { setNickname } = useContext(UserContext);
  const { id } = useContext(UserContext);
  const navigate = useNavigate();
  // console.log(nickname);

  // profile settings
  const Profile = () => {
    const [newNick, setNewNick] = useState("");
    const [nickMessage, setNickMessage] = useState(null);

    const handleChange = (e) => {
      const newText = e.target.value;
      setNewNick(newText);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();

      const { error } = await supabase
        .from("users")
        .update({ nickname: newNick })
        .eq("public_id", id);

      if (error) {
        console.log("Error updating nickname: ", error.message);
        setNickMessage("An unexpected error occured. Please try again.");
        setTimeout(() => setNickMessage(null), 5000);
      } else {
        setNickname(newNick);
        setNickMessage("Success!");
        setTimeout(() => setNickMessage(null), 5000);
        setNewNick("");
      }
    };

    return (
      <>
        <Tray nickname={nickname} />
        <section className="nickname setting">
          <form className="nick-form" onSubmit={handleSubmit}>
            <h3>Change Your Nickname</h3>
            <span>Current Username: {`${nickname}#${id.slice(0, 6)}`}</span>
            <input
              onChange={handleChange}
              value={newNick}
              maxLength={8}
            ></input>
            <button className="nick-submit-btn" type="submit">
              Submit
            </button>
            <span className="nick-message">{nickMessage}</span>
          </form>
        </section>
      </>
    );
  };

  // Account settings
  const Account = () => {
    return (
      <>
        <section className="delete-acct setting">
          <button className="delete-acct-btn">
            <h3>Delete Your Account</h3>
          </button>
        </section>
      </>
    );
  };

  // where each individual setting page is rendered
  const renderContent = () => {
    switch (selectedSection) {
      case "profile":
        return <Profile />;
      case "account":
        return <Account />;
      case "notifications":
        return <div>Your Notification Settings</div>;
      case "privacy":
        return <div>Your Privacy Settings</div>;
      default:
        return <div>Select a section to view settings</div>;
    }
  };

  // main user settings page structure
  return (
    <div className="user-settings-wrapper">
      <div className="left">
        <ul>
          <li
            className={selectedSection === "profile" ? "active" : ""}
            onClick={() => setSelectedSection("profile")}
          >
            Profile
          </li>
          <li
            className={selectedSection === "account" ? "active" : ""}
            onClick={() => setSelectedSection("account")}
          >
            Account
          </li>
          <li
            className={selectedSection === "notifications" ? "active" : ""}
            onClick={() => setSelectedSection("notifications")}
          >
            Notifications
          </li>
          <li
            className={selectedSection === "privacy" ? "active" : ""}
            onClick={() => setSelectedSection("privacy")}
          >
            Privacy
          </li>
          {/* <li className="back" onClick={() => navigate("/messages")}>
            Back
          </li> */}
        </ul>
      </div>
      <div className="right">{renderContent()}</div>
    </div>
  );
}

export default UserSettings;
