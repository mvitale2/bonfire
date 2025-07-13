import { useEffect, useState, useRef } from "react";
import supabase from "../../../../Supabase";
import { useNavigate, useLocation } from "react-router-dom";
import Avatar from "../../UI Components/Avatar/Avatar";
import { MdCallEnd } from "react-icons/md";
// import Tray from "../../UI Components/Tray/Tray";
import { useParams } from "react-router-dom";
import "./Call.css";

function Call() {
  const { roomId } = useParams();
  const [targetId, setTargetId] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionMessage, setConnectionMessage] = useState(null);
  const peerConnectionRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const accepting = params.get("accepting");

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        supabase.from("signals").insert({
          room_id: roomId,
          type: "candidate",
          candidate: JSON.stringify(event.candidate),
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setConnectionMessage("Connected");
      } else if (
        pc.connectionState == "failed" ||
        pc.connectionState === "disconnected"
      ) {
        setConnectionMessage("Disconnected");
      }
    };

    return pc;
  };

  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const handleStateChange = () => {
      setConnectionMessage(pc.connectionState);
    };

    pc.addEventListener("connectionstatechange", handleStateChange);

    setConnectionMessage(pc.connectionState);

    return () => {
      pc.removeEventListener("connectionsstatechagne", handleStateChange);
    };
  }, [peerConnectionRef.current]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      setLocalStream(stream);
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("webrtc-signals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const { type, payload: signalPayload, candidate } = payload.new;
          // if (!localStream) return;
          if (!peerConnectionRef.current) {
            const pc = createPeerConnection();
            localStream
              .getTracks()
              .forEach((track) => pc.addTrack(track, localStream));
            peerConnectionRef.current = pc;
          }

          const pc = peerConnectionRef.current;

          console.log(`Offer detected: ${type}`);

          if (type === "answer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signalPayload)
            );
            console.log("connection sucecsff");
          } else if (type === "candidate") {
            await pc.addIceCandidate(
              new RTCIceCandidate(JSON.parse(candidate))
            );
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomId]);

  const handleEndCall = async () => {
    const { error } = await supabase
      .from("signals")
      .delete()
      .eq("room_id", roomId);

    if (error) {
      console.log(`Error ending call: ${error.message}`);
    } else {
      navigate("/friends");
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("call-ended-listener")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "signals",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          alert("The call has ended.");
          navigate("/friends");
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomId, navigate]);

  useEffect(() => {
    const fetchTargetAvatar = async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("from_user_id, to_user_id")
        .eq("room_id", roomId)
        .eq("type", "offer")
        .single();

      if (error) {
        console.log(`Error retrieving target user id: ${error.message}`);
        return;
      } else {
        accepting === "true"
          ? setTargetId(data.from_user_id)
          : setTargetId(data.to_user_id);
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
        {connectionMessage ? (
          <div className="connection-status-wrapper">
            <p className="connection-status">{connectionMessage}</p>
          </div>
        ) : null}
        <div className="action-tray">
          <button className="end-call" onClick={handleEndCall}>
            <MdCallEnd />
          </button>
        </div>
      </div>
      {/* local user's audio (muted) */}
      <audio
        autoPlay
        playsInline
        muted
        ref={(audio) => audio && localStream && (audio.srcObject = localStream)}
      />
      {/* remote audio */}
      <audio
        autoPlay
        playsInline
        ref={(audio) =>
          audio && remoteStream && (audio.srcObject = remoteStream)
        }
      />
    </>
  );
}

export default Call;
