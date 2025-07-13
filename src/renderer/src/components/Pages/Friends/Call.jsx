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

    return pc;
  };

  useEffect(() => {
    if (!localStream) return;
    if (!peerConnectionRef.current) {
      const pc = createPeerConnection();
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));
      peerConnectionRef.current = pc;
    }
  }, [localStream]);

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
          const { type, sdp, candidate } = payload.new;
          const pc = peerConnectionRef.current;

          if (type === "offer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type, sdp })
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await supabase.from("signals").insert({
              room_id: roomId,
              type: "answer",
              sdp: answer.sdp,
            });
          } else if (type === "answer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type, sdp })
            );
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
        accepting === true
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
