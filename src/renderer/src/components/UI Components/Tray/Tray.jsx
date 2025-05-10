import React from "react";
import { IoMdSettings } from "react-icons/io";
import { Link } from "react-router-dom";
import "./Tray.css";

function Tray() {
  return (
    <div className="tray-wrapper">
      <div className="profile">
        <div className="pfp">
          <img></img>
        </div>
        <div className="nickname"></div>
        <div className="status"></div>
      </div>
      <div className="actions">
        <div className="settings">
          <Link to="/settings">
            <IoMdSettings />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Tray;
