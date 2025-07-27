import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../../UserContext";
import supabase from "../../../../Supabase";
import "./CallToast.css";
import { MdCall, MdCallEnd } from "react-icons/md";
import Avatar from "../Avatar/Avatar";
import getNickname from "../../../getNickname";

function CallToast({
  caller_id,
  callee_id,
  initiator = false,
  receiver = false,
  room_id,
}) {
  const { setInCall } = useContext(UserContext);
  const [fromUserNickname, setFromUserNickname] = useState(null);
  const [toUserNickname, setToUserNickname] = useState(null);

  useEffect(() => {
    const fetchNickname = async () => {
      if (receiver === true) {
        const nickname = await getNickname(caller_id);
        setFromUserNickname(nickname);
      } else {
        const nickname = await getNickname(callee_id);
        setToUserNickname(nickname);
      }
    };

    fetchNickname();
  }, [callee_id, caller_id, receiver]);

  const handleAnswerCall = async () => {
    // setInCall(true);
  };

  const handleEndCall = async () => {
    setInCall(false);

    const { error } = await supabase
      .from("signals")
      .delete()
      .eq("room-id", room_id);

    if (error) {
      console.log(`Error removing signals: ${error.message}`)
    }
  };

  function IncomingCall() {
    return (
      <div className="call-btns" onClick={async () => await handleAnswerCall()}>
        <div className="answer-call-btn">
          <MdCall />
        </div>
        <div
          className="decline-call-btn"
          onClick={async () => await handleEndCall()}
        >
          <MdCallEnd />
        </div>
      </div>
    );
  }

  function OutgoingCall() {
    return (
      <div className="outgoing-call">
        <div
          className="end-call-btn"
          onClick={async () => await handleEndCall()}
        >
          <MdCallEnd />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="call-toast-wrapper">
        <div className="call-avatar-div">
          <div className="username">
            {receiver === true ? (
              <p>
                {fromUserNickname}#{caller_id.slice(0, 6)}
              </p>
            ) : (
              <p>
                {toUserNickname}#{callee_id.slice(0, 6)}
              </p>
            )}
          </div>
          <div className="pfp">
            {receiver === true ? (
              <Avatar otherUserId={caller_id} />
            ) : (
              <Avatar otherUserId={callee_id} />
            )}
          </div>
        </div>
        {/* show incoming or outgoing call based on whether or not the user is the initiator or receiver */}
        {initiator === true ? <OutgoingCall /> : null}
        {receiver === true ? <IncomingCall /> : null}
      </div>
    </>
  );
}

export default CallToast;
