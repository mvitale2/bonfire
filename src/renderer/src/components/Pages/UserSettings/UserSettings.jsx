import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import "./UserSettings.css";
import { UserContext } from "../../../UserContext.jsx";
import supabase from "../../../../Supabase.jsx";
import Tray from "../../UI Components/Tray/Tray";
import Avatar from "../../UI Components/Avatar/Avatar.jsx";

function UserSettings() {
  const [selectedSection, setSelectedSection] = useState("profile"); // Default section
  const { nickname, setNickname, id, avatar, setAvatar } =
    useContext(UserContext);
  const navigate = useNavigate();
  // console.log(nickname);

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (!confirmLogout) return;

    //Ends session, clears local storage, and redirects to login page
    await supabase.auth.signOut();
    localStorage.clear();
    navigate("/login");
  };

  // profile settings
  const Profile = () => {
    // Avatar stuff
    // ---------------------------------------------------------
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    function generateFiveDigitNumber() {
      return Math.floor(10000 + Math.random() * 90000);
    }

    const handleUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploading(true);
      setUploadError(null);

      const randomNumber = generateFiveDigitNumber();

      const fileExt = file.name.split(".").pop();
      const fileName = `${id}${randomNumber}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { data, error } = await supabase.storage
        .from("profile-pics")
        .remove(`avatars/${fileName}`);

      if (error) {
        console.error("Error deleting file:", error);
      } else {
        console.log("File deleted successfully");
      }

      const { error: uploadError } = await supabase.storage
        .from("profile-pics")
        .upload(filePath, file, {
          upsert: true, // allow overwriting
          cacheControl: "3600",
          contentType: file.type,
        });

      if (uploadError) {
        console.error("Upload failed:", uploadError.message);
        setUploadError("Upload failed!");
        setUploading(false);
        return;
      }

      // Get the public URL of the uploaded image
      const { data: publicUrlData, error: urlError } = supabase.storage
        .from("profile-pics")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;

      if (urlError || !publicUrl) {
        console.error("Failed to get public URL:", urlError?.message);
        setUploadError("Could not retrieve public URL");
        setUploading(false);
        return;
      }

      // Update the user's profile_pic_url in the database
      const { error: dbError } = await supabase
        .from("users")
        .update({ profile_pic_url: publicUrl })
        .eq("public_id", id);

      if (dbError) {
        console.error("Database update error:", dbError.message);
        setUploadError("Failed to update profile in database");
      } else {
        setAvatar(publicUrl);
        console.log("Profile picture updated successfully:", publicUrl);
      }

      setUploading(false);
    };
    // ---------------------------------------------------------------------

    // Change nickname
    const [newNick, setNewNick] = useState("");
    const [nickMessage, setNickMessage] = useState(null);

    const handleNickChange = (e) => {
      const newText = e.target.value;
      setNewNick(newText);
    };

    const handleNickSubmit = async (e) => {
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
        <section className="nickname setting">
          <form className="nick-form" onSubmit={handleNickSubmit}>
            <h3>Change Your Nickname</h3>
            <span>Current Username: {`${nickname}#${id.slice(0, 6)}`}</span>
            <input
              onChange={handleNickChange}
              // value={newNick}
              maxLength={8}
            ></input>
            <button className="nick-submit-btn" type="submit">
              Submit
            </button>
            <span className="nick-message">{nickMessage}</span>
          </form>
        </section>

        <section className="setting">
          <h3>Profile Picture</h3>
          <Avatar />
          <input type="file" accept="image/*" onChange={handleUpload} />
          {uploading && <span>Uploading...</span>}
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
    <>
      <Tray nickname={nickname} />
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
          <button className="logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
        <div className="right">{renderContent()}</div>
      </div>
    </>
  );
}

export default UserSettings;
