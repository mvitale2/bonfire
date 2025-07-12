import { useState, useRef, useContext, useEffect } from "react";
import { UserContext } from "../../../UserContext.jsx";
import { useSignal } from "./signal.js";
// filepath: c:\Users\grant\Desktop\Oakland Summer 2025\CSI 4999\bonfire\src\renderer\src\components\Pages\webrtc\callpage.jsx
import supabase from "../../../../Supabase.jsx";

export default function CallPage({ callee, onClose }) {
  const { id: selfId } = useContext(UserContext);
  const [roomId, setRoomId] = useState(null);

  const pc = useRef(null);
  const localVid = useRef(null);
  const remoteVid = useRef(null);

  const { send } = useSignal(roomId, selfId, async (signal) => {
    if (!pc.current) return;
    if (signal.type === "answer") {
      await pc.current.setRemoteDescription(signal.payload);
    } else if (signal.type === "candidate") {
      await pc.current.addIceCandidate(signal.payload);
    } else if (signal.type === "offer") {
      await ensureStream();
      await pc.current.setRemoteDescription(signal.payload);
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      send(signal.from_user_id, "answer", answer);
    }
  });

  const ensureStream = async () => {
    if (localVid.current.srcObject) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));
    localVid.current.srcObject = stream;
  };

  const newPeer = () => {
    const p = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    p.ontrack = (e) => (remoteVid.current.srcObject = e.streams[0]);
    p.onicecandidate = (e) =>
      e.candidate && send(callee, "candidate", e.candidate.toJSON());
    return p;
  };

  const call = async () => {
    let room = roomId;
    if (!room) {
      const { data } = await supabase
        .from("chat_rooms")
        .insert({
          name: `${selfId.slice(0, 4)}-${callee.slice(0, 4)}`,
          creator_user_id: selfId,
        })
        .select()
        .single();
      room = data.id;
      setRoomId(room);
    }

    pc.current = newPeer();
    await ensureStream();

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    send(callee, "offer", offer);
  };

  // Clean up on close
  const hangUp = () => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    if (localVid.current && localVid.current.srcObject) {
      localVid.current.srcObject.getTracks().forEach((track) => track.stop());
      localVid.current.srcObject = null;
    }
    if (remoteVid.current && remoteVid.current.srcObject) {
      remoteVid.current.srcObject.getTracks().forEach((track) => track.stop());
      remoteVid.current.srcObject = null;
    }
    if (onClose) onClose();
  };

  useEffect(() => {
    return hangUp;
    // eslint-disable-next-line
  }, []);

  return (
    <div
      style={{
        background: "#222",
        padding: 16,
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div>
        <video
          ref={localVid}
          autoPlay
          muted
          playsInline
          style={{ width: 180, marginRight: 8 }}
        />
        <video ref={remoteVid} autoPlay playsInline style={{ width: 180 }} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={call}>Call friend</button>
        <button
          onClick={hangUp}
          style={{ marginLeft: 8, background: "#c00", color: "#fff" }}
        >
          Hang Up
        </button>
      </div>
    </div>
  );
}
