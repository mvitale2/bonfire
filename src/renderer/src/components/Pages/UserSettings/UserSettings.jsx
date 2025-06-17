import MessagePage from "../Message/Message.jsx";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
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

  const navigate = useNavigate();

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
    const [newNick, setNewNick] = useState("");
    const [nickMessage, setNickMessage] = useState(null);

    const [uploading, setUploading] = useState(false);
    const [profilePic, setProfilePic] = useState(null);
    const [uploadError, setUploadError] = useState(null);

    useEffect(() => {
      const fetchProfilePicture = async () => {
        const { data, error } = await supabase
          .from("users")
          .select("profile_pic_url")
          .eq("public_id", id)
          .single();

        console.log("Fetching profile for public_id:", id);
        console.log("Response:", data, "Error:", error);

        if (!error && data?.profile_pic_url) {
          setProfilePic(data.profile_pic_url);
        } else {
          console.error("Failed to fetch profile picture:", error);
        }
      };
      fetchProfilePicture();
    }, [id, profilePic]);

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

    function generateFiveDigitNumber() {
      return Math.floor(10000 + Math.random() * 90000);
    }

    const handleUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
    
      setUploading(true);
      setUploadError(null);

      // Example usage:
      const randomNumber = generateFiveDigitNumber();
      console.log(randomNumber); // e.g., 48327
    
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}${randomNumber}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { data, error} = await supabase
        .storage
        .from('profile-pics')
        .remove(`avatars/${fileName}`)

      if (error) {
        console.error('Error deleting file:', error);
      } else {
        console.log('File deleted successfully');
      }
    
      const { error: uploadError } = await supabase.storage
        .from("profile-pics")
        .upload(filePath, file, {
          upsert: true, // allow overwriting
          cacheControl: '3600',
          contentType: file.type,
        });
    
      if (uploadError) {
        console.error("Upload failed:", uploadError.message);
        setUploadError("Upload failed!");
        setUploading(false);
        return;
      }
    
      // Get the public URL of the uploaded image
      const { data: publicUrlData, error: urlError } = supabase
        .storage
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
        setProfilePic(publicUrl);
        console.log("Profile picture updated successfully:", publicUrl);
      }
    
      setUploading(false);
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

      <section className="avatar setting">
        <h3>Profile Picture</h3>
        {profilePic && (
          <img
            src={profilePic}
            alt="Profile"
            style={{ width: 96, height: 96, borderRadius: "50%" }}
          />
        )}
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
  );
}

export default UserSettings;