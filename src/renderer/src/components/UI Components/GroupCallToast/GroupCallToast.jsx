import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../../UserContext";
import supabase from "../../../../Supabase";
import { MdCall, MdCallEnd } from "react-icons/md";
import { MdConnectWithoutContact } from "react-icons/md";
import Avatar from "../Avatar/Avatar";
import SimplePeer from "simple-peer";
import "./GroupCallToast.css";

function GroupCallToast({ room_id }) {
  const { id, inGroupCall, setInGroupCall } = useContext(UserContext);
  const [connected, setConnected] = useState(false);
  console.log(room_id);

  const handleEndCall = async () => {
    setInGroupCall([false, null]);

    const { data, error } = await supabase
      .from("bonfires")
      .select("joined_users")
      .eq("room_id", room_id)
      .single();

    if (error) {
      console.log(`Error retrieving joined users: ${error.message}`);
      return;
    }

    let updatedUsers = Array.isArray(data.joined_users)
      ? [...data.joined_users]
      : [];

    updatedUsers = updatedUsers.filter((userId) => userId !== id);

    console.log(updatedUsers);

    const { error: updateError } = await supabase
      .from("bonfires")
      .update({ joined_users: updatedUsers })
      .eq("room_id", room_id);

    if (updateError) {
      console.log(`Error updating joined users: ${updateError.message}`);
    }
  };

  return (
    <>
      <div className="call-toast-wrapper">
        <div className="status-icons">
          <div
            className={`connection-status ${connected ? "connected" : "disconnected"}`}
          >
            <MdConnectWithoutContact />
          </div>
        </div>
        <div className="call-avatar-div">
          <button
            className="end-call-btn"
            onClick={async () => await handleEndCall()}
          >
            <MdCallEnd />
          </button>
        </div>
      </div>
    </>
  );
}

export default GroupCallToast;
