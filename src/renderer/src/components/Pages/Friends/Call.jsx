import { useEffect, useState, useRef, useContext } from "react";
import supabase from "../../../../Supabase";
import { useNavigate, useLocation } from "react-router-dom";
import Avatar from "../../UI Components/Avatar/Avatar";
import { MdCallEnd } from "react-icons/md";
// import Tray from "../../UI Components/Tray/Tray";
import { useParams } from "react-router-dom";
import "./Call.css";
import { UserContext } from "../../../UserContext";

function Call() {
  const { roomId } = useParams();
  const { id } = useContext(UserContext);
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
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:162.248.100.4:3479",
          username: "root",
          credential: toString(import.meta.env.VPS_CREDENTIAL),
        },
      ],
    });

    pc.addEventListener("icecandidate", (event) => {
      console.log("ICE candidate event:", event.candidate);
      if (!event.candidate) return;
      if (event.candidate) {
        supabase.from("signals").insert({
          room_id: roomId,
          type: "candidate",
          candidate: JSON.stringify(event.candidate),
        });
      }
    });

    pc.addEventListener("addstream", (event) => {
      setRemoteStream(event.streams[0]);
    });

    pc.addEventListener("connectionstatechange", (event) => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setConnectionMessage("Connected");
      } else if (
        pc.connectionState == "failed" ||
        pc.connectionState === "disconnected"
      ) {
        setConnectionMessage("Disconnected");
      }
    });

    return pc;
  };

  // send offer on mount if the user is the initator
  // also get the audio tracks
  useEffect(() => {
    const updateOffer = async () => {
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (accepting != "true") {
        const { error } = await supabase
          .from("signals")
          .update({ payload: { type: offer.type, sdp: offer.sdp } })
          .eq("room_id", roomId)
          .eq("type", "offer");

        if (error) {
          console.log(`Error updating payload: ${error.message}`);
          return;
        }
      }

      return () => {
        pc.close();
        peerConnectionRef.current = null;
      };
    };

    updateOffer();
    // get audio
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      setLocalStream(stream);
    });
  }, []);

  useEffect(() => {
    console.log("Local audio stream:");
    console.log(localStream);
  }, [localStream]);

  // connection state handlers
  useEffect(() => {
    const pc = peerConnectionRef.current;
    console.log("Peer Connection:");
    console.log(pc);
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

  // signal listener
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
          const {
            type,
            payload: signalPayload,
            candidate,
            from_user_id,
          } = payload.new;

          const pc = peerConnectionRef.current;

          console.log(`Signal detected: ${type}`);

          if (type === "answer" && from_user_id != id) {
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

  // end call listener
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

  // avatar fetcher
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
