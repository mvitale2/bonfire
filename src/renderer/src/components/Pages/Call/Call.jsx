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
  const [toUserId, setToUserId] = useState(null);
  const [targetId, setTargetId] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionMessage, setConnectionMessage] = useState(null);
  const [answerSent, setAnswerSent] = useState(false);
  const [callended, setCallEnded] = useState(false);
  const [remoteCandidates, setRemoteCandidates] = useState([]);
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
          username: "test",
          credential: "tset123",
        },
      ],
    });

    pc.addEventListener("icecandidate", async (event) => {
      console.log("ICE candidate event:", event.candidate);
      if (!event.candidate) return;
      if (event.candidate) {
        const { error } = await supabase.from("signals").insert({
          room_id: roomId,
          type: "candidate",
          payload: JSON.stringify(event.candidate),
        });

        if (error)
          console.log(`Error uploading ice candidate: ${error.message}`);
      }
    });

    pc.addEventListener("icecandidateerror", (event) => {
      console.log("ICE error:", event);
    });

    pc.addEventListener("track", (event) => {
      const [stream] = event.streams;
      if (stream) setRemoteStream(stream);
    });

    pc.addEventListener("negotiationneeded", async (event) => {
      console.log("Negotiation needed, sending new offer.");
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const { error } = await supabase.from("signals").insert({
        room_id: roomId,
        from_user_id: id,
        to_user_id: toUserId,
        type: "offer",
        payload: { type: offer.type, sdp: offer.sdp },
      });

      if (error) {
        console.log(`Error uploading new offer: ${error.message}`);
        return;
      }
    });

    return pc;
  };

  // get audio on mount
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      setLocalStream(stream);
    });
  }, []);

  useEffect(() => {
    console.log("Local audio stream:");
    console.log(localStream);
  }, [localStream]);

  useEffect(() => {
    if (!peerConnectionRef) return;
    console.log("ICE gathering state:", peerConnectionRef.iceGatheringState);
  }, [peerConnectionRef.iceGatheringState]);

  // send offer on mount if the user is the initator
  useEffect(() => {
    setCallEnded(false);
    if (localStream) {
      const updateOffer = async () => {
        const pc = createPeerConnection();
        peerConnectionRef.current = pc;
        localStream
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStream));
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

        // return () => {
        //   pc.close();
        //   peerConnectionRef.current = null;
        // };
      };

      updateOffer();
    }
  }, [localStream]);

  // listener for accepting user
  useEffect(() => {
    const acceptCall = async () => {
      if (accepting === "true" && localStream && !answerSent) {
        const { data, error } = await supabase
          .from("signals")
          .select("payload, from_user_id, to_user_id")
          .eq("room_id", roomId)
          .eq("type", "offer")
          .single();

        if (error || !data?.payload) {
          console.log("Error fetching offer payload:", error?.message);
          return;
        }

        setToUserId(data.to_user_id);

        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        console.log("ICE gathering state:", pc.iceGatheringState);

        if (localStream) {
          localStream
            .getTracks()
            .forEach((track) => pc.addTrack(track, localStream));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await supabase.from("signals").insert({
          room_id: roomId,
          from_user_id: id,
          to_user_id: data.from_user_id,
          type: "answer",
          payload: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });

        setAnswerSent(true);
      }
    };

    acceptCall();
  }, [accepting, localStream, answerSent]);

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
          const { type, payload: signalPayload, from_user_id } = payload.new;

          const pc = peerConnectionRef.current;

          console.log(`Signal detected: ${type}`);

          if (type === "offer" && from_user_id != id) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signalPayload)
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await supabase.from("signals").insert({
              room_id: roomId,
              from_user_id: id,
              to_user_id: from_user_id,
              type: "answer",
              payload: {
                type: answer.type,
                sdp: answer.sdp,
              },
            });
          }
          if (type === "answer" && from_user_id != id) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signalPayload)
            );

            remoteCandidates.forEach((candidate) =>
              pc.addIceCandidate(candidate)
            );

            setRemoteCandidates([])
          }
          if (type === "candidate" && from_user_id != id) {
            setRemoteCandidates((prevCandidates) => [
              ...prevCandidates,
              signalPayload,
            ]);
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
    if (callended) return;
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
          setCallEnded(true);
          setAnswerSent(false);
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
