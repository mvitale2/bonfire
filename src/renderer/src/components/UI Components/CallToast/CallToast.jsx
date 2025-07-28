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
  initiator,
  receiver,
  room_id,
  payload,
}) {
  const { setInCall, remotePeerRef } = useContext(UserContext);
  const [fromUserNickname, setFromUserNickname] = useState(null);
  const [toUserNickname, setToUserNickname] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

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
    setCallAccepted(true)
    const signal = payload;
    remotePeerRef.current = new SimplePeer({
      initiator: false,
      trickle: false,
    });
    remotePeerRef.current.signal(signal);
  };

  const handleEndCall = async () => {
    setInCall(false);
    setCallAccepted(false)

    const { error } = await supabase
      .from("signals")
      .delete()
      .eq("room_id", room_id);

    if (error) {
      console.log(`Error removing signals: ${error.message}`);
    }
  };

  function IncomingCall() {
    function IncomingCallBtns() {
      return (
        <>
          <div className="call-btns">
            {" "}
            <div
              className="answer-call-btn"
              onClick={async () => await handleAnswerCall()}
            >
              <MdCall />
            </div>
            <div
              className="decline-call-btn"
              onClick={async () => await handleEndCall()}
            >
              <MdCallEnd />
            </div>
          </div>
        </>
      );
    }

    function CallAcceptedBtn() {
      return (
        <div
          className="end-call-btn"
          onClick={async () => await handleEndCall()}
        >
          <MdCallEnd />
        </div>
      );
    }

    return callAccepted ? <CallAcceptedBtn /> : <IncomingCallBtns />;
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
        {/* show incoming or outgoing call based on whether or not the user is the initiator or receiver */}
        {initiator === true ? <OutgoingCall /> : null}
        {receiver === true ? <IncomingCall /> : null}
        <div className="call-avatar-div">
          <div className="username">
            {receiver === true ? (
              <p>{fromUserNickname}</p>
            ) : (
              <p>{toUserNickname}</p>
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
      </div>
    </>
  );
}

export default CallToast;
