import { IoMdSettings } from "react-icons/io";
import { Link } from "react-router-dom";
import { CgProfile } from "react-icons/cg";
import "./Tray.css";

function Tray({ nickname, pfp }) {
  console.log(pfp)
  return (
    <div className="tray-wrapper">
      <div className="profile">
        <div className="pfp">
          {pfp === undefined ? <CgProfile/> : <img src={pfp}></img>}
        </div>
        <div className="nickname">{nickname}</div>
        {/* <div className="status"></div> */}
      </div>
      <div className="actions">
        <div className="settings">
          <Link to="/user-settings">
            <IoMdSettings />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Tray;
