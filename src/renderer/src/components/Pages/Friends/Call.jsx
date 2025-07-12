import { useEffect, useState, useContext } from "react";
import supabase from "../../../../Supabase";
// import { UserContext } from "../../../UserContext";
import { useNavigate } from "react-router-dom";
import Avatar from "../../UI Components/Avatar/Avatar";
import { MdCallEnd } from "react-icons/md";
// import Tray from "../../UI Components/Tray/Tray";
import { useParams } from "react-router-dom";
import "./Call.css";

function Call() {
  const { roomId } = useParams();
  const [targetId, setTargetId] = useState("");
  const navigate = useNavigate();

  const handleEndCall = async () => {
    const { error } = await supabase
      .from("signals")
      .update({ ended_at: new Date().toISOString() })
      .eq("room_id", roomId);

    if (error) {
      console.log(`Error ending call: ${error.message}`);
    } else {
      navigate("/friends");
    }
  };

  useEffect(() => {
    const fetchTargetAvatar = async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("to_user_id")
        .eq("room_id", roomId)
        .single();

      if (error) {
        console.log(`Error retrieving target user id: ${error.message}`);
        return;
      } else {
        setTargetId(data.to_user_id);
      }
    };

    fetchTargetAvatar();
  }, []);

  return (
    <>
      {/* <Tray /> */}
      <div className="call-wrapper">
        <div className="avatars">
          <Avatar />
          <Avatar otherUserId={targetId} />
        </div>
        <div className="action-tray">
          <button className="end-call" onClick={handleEndCall}>
            <MdCallEnd />
          </button>
        </div>
      </div>
    </>
  );
}

export default Call;
