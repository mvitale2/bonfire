import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../../UserContext";
import supabase from "../../../../Supabase";
import "./CallToast.css";
import { MdCall, MdCallEnd } from "react-icons/md";
import Avatar from "../Avatar/Avatar";
import getNickname from "../../../getNickname";
import SimplePeer from "simple-peer";

function CallToast({
  remote_id,
  initiator,
  room_id,
}) {
  const { setInCall, inCall, peerRef, remotePeerRef, id } =
    useContext(UserContext);
  const [fromUserNickname, setFromUserNickname] = useState(null);
  const [toUserNickname, setToUserNickname] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const audioRef = useRef(null);

  // peer creation for receiver & initiator
  useEffect(() => {
    if (inCall === false || callAccepted === false) return;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const localPeer = new SimplePeer({
        initiator: initiator,
        trickle: true,
        stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            {
              urls: "turn:162.248.100.4:3479",
              username: "test",
              credential: "tset123",
            },
            {
              urls: "turns:162.248.100.4:5349",
              username: "test",
              credential: "tset123",
            },
          ],
        },
      });
      peerRef.current = localPeer

      localPeer.on("signal", async (data) => {
        console.log(`Sending offer to ${remote_id}`)
        await supabase.from("signals").insert({
          room_id: room_id,
          from_user_id: id,
          to_user_id: remote_id,
          payload: JSON.stringify(data),
        });
      });

      localPeer.on("stream", (remoteStream) => {
        audioRef.current.srcObject = remoteStream;
        audioRef.current.play();
      });

      const subscription = supabase
        .channel("voice-comms")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "signals",
          },
          (payload) => {
            const { from_user_id, payload: signal } = payload.new;
            if (from_user_id !== id) {
              localPeer.signal(signal);
            }
          }
        )
        .subscribe();

        console.log("In call!")

        return () => supabase.removeChannel(subscription);
    });
  }, [inCall, callAccepted]);

  useEffect(() => {
    const fetchNickname = async () => {
      if (initiator === false && id) {
        const nickname = await getNickname(id);
        setFromUserNickname(nickname);
      } else if (remote_id) {
        const nickname = await getNickname(remote_id);
        setToUserNickname(nickname);
      }
    };

    fetchNickname();
  }, [remote_id, initiator]);

  const handleAnswerCall = async () => {
    setCallAccepted(true);
    setInCall(true)
  };

  const handleEndCall = async () => {
    setInCall(false);
    setCallAccepted(false);

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (remotePeerRef.current) {
      remotePeerRef.current.destroy();
      remotePeerRef.current = null;
    }

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
        {initiator === false ? <IncomingCall /> : null}
        <div className="call-avatar-div">
          <div className="username">
            {initiator === false ? (
              <p>{fromUserNickname}</p>
            ) : (
              <p>{toUserNickname}</p>
            )}
          </div>
          <div className="pfp">
            {initiator === false ? (
              <Avatar />
            ) : (
              <Avatar otherUserId={remote_id} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default CallToast;
