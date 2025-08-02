import { useContext } from "react";
import { Link } from "react-router-dom";
import { IoMdSettings } from "react-icons/io";
import { FaUserFriends } from "react-icons/fa";
import { FaMessage } from "react-icons/fa6";
import { UserContext } from "../../../UserContext.jsx";
import Avatar from "../Avatar/Avatar.jsx";
import "./Tray.css";

function Tray({ nickname, unreadCount }) {
  const { hideNickname } = useContext(UserContext);

  return (
    <div className="tray-wrapper">
      <div className="profile">
        <div className="pfp">
          <Avatar />
        </div>
        <div className="nickname">{hideNickname ? "Anonymous" : nickname}</div>
      </div>
      <div className="actions">
        <div className="icon">
          <Link to="/user-settings">
            <IoMdSettings />
          </Link>
        </div>
        <div className="icon">
          <Link to="/friends">
            <FaUserFriends />
          </Link>
        </div>
        <div className="icon" style={{ position: "relative" }}>
          <Link to="/messages">
            <FaMessage />
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Tray;
