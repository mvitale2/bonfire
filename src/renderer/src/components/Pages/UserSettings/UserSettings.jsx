import React, { useState } from "react";
import "./UserSettings.css";

function UserSettings() {
  const [selectedSection, setSelectedSection] = useState("profile"); // Default section

  const renderContent = () => {
    switch (selectedSection) {
      case "profile":
        return <div>Your Profile Settings</div>;
      case "account":
        return <div>Your Account Settings</div>;
      case "notifications":
        return <div>Your Notification Settings</div>;
      case "privacy":
        return <div>Your Privacy Settings</div>;
      default:
        return <div>Select a section to view settings</div>;
    }
  };

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
        </ul>
      </div>
      <div className="right">{renderContent()}</div>
    </div>
  );
}

export default UserSettings;
