import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../../UserContext";
import supabase from "../../../../Supabase";
import "./CallToast.css";
import { MdCall, MdCallEnd } from "react-icons/md";
import { MdConnectWithoutContact } from "react-icons/md";
import Avatar from "../Avatar/Avatar";
import getNickname from "../../../getNickname";
import SimplePeer from "simple-peer";

function CallToast({ remote_id, initiator, room_id }) {
  const { setInCall, inCall, peerRef, id } = useContext(UserContext);
  const [remoteUserNickname, setRemoteUserNickname] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [remoteAccepted, setRemoteAccepted] = useState(false);
  const [connected, setConnected] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (initiator === true && callAccepted === false) {
      setCallAccepted(true);
    } else {
      return;
    }

    const sendInitialOffer = async () => {
      await supabase.from("signals").insert({
        room_id: room_id,
        from_user_id: id,
        to_user_id: remote_id,
        type: "initial",
      });
    };

    sendInitialOffer();
  }, []);

  // answered call listener
  useEffect(() => {
    if (initiator === false) return;

    const channel = supabase
      .channel("call_status")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_status",
          filter: `room_id=eq.${room_id}`,
        },
        (payload) => {
          if (payload.new.accepted) {
            setRemoteAccepted(true);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [initiator, room_id]);

  // peer creation for receiver & initiator
  useEffect(() => {
    if (initiator === true && remoteAccepted === false) return;
    if (inCall === false || callAccepted === false) return;

    let subscription;

    console.log("Creating peer...");

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      console.log("Got user media", stream);

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
      peerRef.current = localPeer;

      localPeer.on("connect", () => {
        console.log("connected!");
        localPeer.send(`Hello ${remoteUserNickname}, it's me, ${id}`);
        setConnected(true);
      });

      localPeer.on("data", (data) => {
        const message = data.toString();
        console.log(message);

        if (message === "END CALL") {
          setInCall(false);
          setConnected(false);
        }
      });

      localPeer.on("error", (err) => {
        console.log("Peer error:", err);
      });

      localPeer.on("signal", async (data) => {
        console.log(`Sending offer to ${remote_id}`);
        await supabase.from("signals").insert({
          room_id: room_id,
          from_user_id: id,
          to_user_id: remote_id,
          payload: JSON.stringify(data),
        });
      });

      localPeer.on("stream", (remoteStream) => {
        console.log("I hear audio!");
        console.log(remoteStream);
        audioRef.current.srcObject = remoteStream;
        audioRef.current.play();
      });

      const loadPayload = (payload) => {
        const { payload: signal } = payload.new;
        console.log("Loading detected signal");
        console.log(signal);
        const parsedSignal =
          typeof signal === "string" ? JSON.parse(signal) : signal;
        console.log(parsedSignal);
        localPeer.signal(parsedSignal);
      };

      subscription = supabase
        .channel("voice-comms")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "signals",
            filter: `to_user_id=eq.${id}`,
          },
          (payload) => {
            loadPayload(payload);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "signals",
            filter: `to_user_id=eq.${id}`,
          },
          (payload) => {
            loadPayload(payload);
          }
        )
        .subscribe();

      console.log("Done creating peer");
    });

    return () => {
      supabase.removeChannel(subscription);
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [inCall, callAccepted, initiator, remoteAccepted]);

  // get the remote user's nickname
  useEffect(() => {
    const fetchNickname = async () => {
      const nickname = await getNickname(remote_id);
      setRemoteUserNickname(nickname);
    };

    fetchNickname();
  }, [remote_id, initiator]);

  const handleAnswerCall = async () => {
    setCallAccepted(true);
    setInCall(true);

    // notifies initiator
    await supabase.from("call_status").insert({
      room_id,
      accepted: true,
    });
  };

  const handleEndCall = async () => {
    setInCall(false);
    const { error } = await supabase
      .from("signals")
      .delete()
      .eq("room_id", room_id);

    if (error) {
      console.log(`Error removing signals: ${error.message}`);
    }

    const { acceptError } = await supabase
      .from("call_status")
      .delete()
      .eq("room_id", room_id);

    if (acceptError)
      console.log(`Error deleting call status entry: ${acceptError.message}`);

    if (!peerRef.current || peerRef.current.readyState !== "open") return;

    peerRef.current.send("END CALL");
    peerRef.current.destroy();
    peerRef.current = null;
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
      <audio ref={audioRef} autoPlay style={{ display: "none" }} />
      <div className="call-toast-wrapper">
        {/* show incoming or outgoing call based on whether or not the user is the initiator or receiver */}
        {initiator === true ? <OutgoingCall /> : null}
        {initiator === false ? <IncomingCall /> : null}
        <div className="status-icons">
          <div
            className={`connection-status ${connected ? "connected" : "disconnected"}`}
          >
            <MdConnectWithoutContact />
          </div>
        </div>
        <div className="call-avatar-div">
          <div className="username">
            <p>{remoteUserNickname}</p>
          </div>
          <div className="pfp">
            <Avatar otherUserId={remote_id} />
          </div>
        </div>
      </div>
    </>
  );
}

export default CallToast;
