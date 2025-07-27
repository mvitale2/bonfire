import { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./UserSettings.css";
import { UserContext } from "../../../UserContext.jsx";
import supabase from "../../../../Supabase.jsx";
import Tray from "../../UI Components/Tray/Tray";
import Avatar from "../../UI Components/Avatar/Avatar.jsx";
import Privacy from "./Privacy.jsx";
import defaultAvatar from "../../../assets/default_avatar.png";

// profile settings
const Profile = ({ id, nickname, setNickname, setAvatar }) => {
  console.log("Profile render");
  // Avatar stuff
  // ---------------------------------------------------------
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  function generateFiveDigitNumber() {
    return Math.floor(10000 + Math.random() * 90000);
  }

  const handleDeleteAvatars = async () => {
    // only retrieves 100 files.
    // in the future, for scalability, we will need to implement pagination to get more than 100.
    const { data, error } = await supabase.storage
      .from("profile-pics")
      .list("avatars", { limit: 100 });

    if (error) {
      console.log(`Error listing files: ${error}`);
      return;
    }

    const regex = new RegExp(id);

    const filesToDelete = data
      .filter((file) => regex.test(file.name))
      .map((file) => `avatars/${file.name}`);

    console.log(filesToDelete);

    // it's also possible to instead check if the user has the default profile picture,
    // but might as well do this to be sure
    if (filesToDelete.length === 0) {
      console.log("User has not set a profile picture.");
      return;
    }

    const { error: deleteError } = await supabase.storage
      .from("profile-pics")
      .remove(filesToDelete);

    if (deleteError) {
      console.log(`Error deleting files: ${deleteError}`);
      return;
    } else {
      console.log("Files deleted?");
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.warn("No file selected.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const randomNumber = generateFiveDigitNumber();

    const fileExt = file.name.split(".").pop();
    const fileName = `${id} ${randomNumber}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    console.log("Starting upload...");
    console.log("File info:", {
      name: file.name,
      type: file.type,
      size: file.size,
      filePath,
    });

    await handleDeleteAvatars();

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

    console.log("Upload succeeded.");

    // Get the public URL of the uploaded image
    const { data: publicUrlData, error: urlError } = supabase.storage
      .from("profile-pics")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl;
    console.log("Public URL:", publicUrl);

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
        <button
          type="button"
          onClick={() => document.getElementById("avatar-input").click()}
          className="avatar-upload-btn"
        >
          Choose an image...
        </button>
        <input
          id="avatar-input"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleUpload}
        />
        {uploading && <span>Uploading...</span>}
      </section>
    </>
  );
};

export const UserProvider = ({ children }) => {
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [id, setId] = useState("");
  const [hideNickname, setHideNickname] = useState(false);
  const [hideProfilePic, setHideProfilePic] = useState(false);
  const [inCall, setInCall] = useState(false);
  const peerRef = useRef(null);
  const remotePeerRef = useRef(null);

  // Load user data including privacy prefs here
  useEffect(() => {
    const saved = localStorage.getItem("rememberedUser");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        setNickname(user.nickname);
        setId(user.id);
        setAvatar(user.avatar);
        console.log("Auto-login: loaded user from localStorage");
      } catch (err) {
        console.error("Failed to parse remembered user:", err);
        localStorage.removeItem("rememberedUser");
      }
    }
    const loadUser = async () => {
      const { data, error } = await supabase
        .from("users")
        .select(
          "nickname, profile_pic_url, public_id, hide_nickname, hide_profile_pic"
        )
        .eq("public_id", id)
        .single();

      if (!error && data) {
        setNickname(data.nickname);
        setAvatar(data.profile_pic_url);
        setHideNickname(data.hide_nickname);
        setHideProfilePic(data.hide_profile_pic);
      }
    };

    if (id) loadUser();
  }, [id]);

  return (
    <UserContext.Provider
      value={{
        nickname,
        setNickname,
        avatar,
        setAvatar,
        id,
        setId,
        hideNickname,
        setHideNickname,
        hideProfilePic,
        setHideProfilePic,
        inCall,
        setInCall,
        peerRef,
        remotePeerRef,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

function UserSettings() {
  console.log("UserSettings render");
  const [selectedSection, setSelectedSection] = useState("profile"); // Default section
  const { nickname, setNickname, id, setId, setAvatar } =
    useContext(UserContext);
  const [userInfo, setUserInfo] = useState(null); //Displays user info in account section
  const navigate = useNavigate();
  // console.log(nickname);

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (!confirmLogout) return;

    // Ends session, clears local storage, and redirects to login page
    await supabase.auth.signOut();
    localStorage.clear();
    // probably not necessary but makes sure that the user is not remembered
    localStorage.removeItem("rememberedUser");

    // edits local storage so that changes are effective immediately
    setId("");
    setNickname("");
    navigate("/login");
  };

  // Account settings
  const Account = () => {
    const [userInfo, setUserInfo] = useState(null);
    const { hideNickname, hideProfilePic } = useContext(UserContext);

    useEffect(() => {
      const fetchUserInfo = async () => {
        const { data, error } = await supabase
          .from("users")
          .select("key, public_id, nickname, profile_pic_url")
          .eq("public_id", id)
          .single();

        if (error) {
          console.error("Failed to fetch user info:", error.message);
        } else {
          setUserInfo(data);
        }
      };

      if (id) fetchUserInfo();
    }, [id]);

    return (
      <>
        {userInfo ? (
          <div className="account-info setting">
            <h2>Account Info</h2>
            <div>
              <strong>Key:</strong> {userInfo.key}
            </div>
            <div>
              <strong>Public ID:</strong> {userInfo.public_id}
            </div>
            <div>
              <strong>Nickname:</strong>{" "}
              {hideNickname ? "Anonymous" : userInfo.nickname}
            </div>
            <div>
              <strong>Profile Picture:</strong>
              <br />
              <img
                src={hideProfilePic ? defaultAvatar : userInfo.profile_pic_url}
                alt="Profile"
                className="profile-pic"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/default_avatar.png"; // fallback if link is broken
                }}
              />
            </div>
          </div>
        ) : (
          <p>Loading account info...</p>
        )}
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
        return (
          <Profile
            id={id}
            nickname={nickname}
            setNickname={setNickname}
            setAvatar={setAvatar}
          />
        );
      case "account":
        return <Account />;
      case "notifications":
        return <div>Your Notification Settings</div>;
      case "privacy":
        return <Privacy />;
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
