import { IoMdSettings } from "react-icons/io";
import { Link } from "react-router-dom";
import { FaUserFriends } from "react-icons/fa";
import { FaMessage } from "react-icons/fa6";
import Avatar from "../Avatar/Avatar.jsx";
import "./Tray.css";

function Tray({ nickname }) {
  return (
    <div className="tray-wrapper">
      <div className="profile">
        <div className="pfp">
          <Avatar />
        </div>
        <div className="nickname">{nickname}</div>
        {/* <div className="status"></div> */}
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
        <div className="icon">
          <Link to="/messages">
            <FaMessage />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Tray;
