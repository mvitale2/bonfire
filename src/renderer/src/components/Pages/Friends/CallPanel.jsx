import { useRef, useState, useEffect } from "react";

export default function CallPanel({
  roomId,
  selfId,
  peerId,
  onClose,
  audioOnly,
}) {
  const localV = useRef(null);
  const remoteV = useRef(null);
  const pc = useRef(null);

  // --- Notification state for incoming call ---
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [accepted, setAccepted] = useState(false);

  // --- Helper: Start peer and stream ---
  const ensurePeerAndStream = async () => {
    if (pc.current) return;
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.current.ontrack = (ev) => {
      remoteV.current.srcObject = ev.streams[0];
    };

    pc.current.onicecandidate = (ev) => {
      // send candidate to peer (implement your signaling here)
    };

    // camera + mic or just mic
    const stream = await navigator.mediaDevices.getUserMedia({
      video: audioOnly ? false : true,
      audio: true,
    });
    stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));
    localV.current.srcObject = stream;
  };

  // --- End call and cleanup ---
  const endCall = () => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    if (localV.current && localV.current.srcObject) {
      localV.current.srcObject.getTracks().forEach((track) => track.stop());
      localV.current.srcObject = null;
    }
    if (remoteV.current && remoteV.current.srcObject) {
      remoteV.current.srcObject.getTracks().forEach((track) => track.stop());
      remoteV.current.srcObject = null;
    }
    onClose();
  };

  // --- Accept incoming call (for notification) ---
  const acceptCall = async () => {
    setAccepted(true);
    await ensurePeerAndStream();
    // set remote description, create answer, send answer (implement signaling)
  };

  useEffect(() => {
    return endCall;
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
        <audio
          ref={localV}
          autoPlay
          muted
          playsInline
          style={{
            width: 180,
            marginRight: 8,
            display: audioOnly ? "block" : "none",
          }}
        />
        {!audioOnly && (
          <video
            ref={localV}
            autoPlay
            muted
            playsInline
            style={{ width: 180, marginRight: 8 }}
          />
        )}
        <audio
          ref={remoteV}
          autoPlay
          playsInline
          style={{ width: 180, display: audioOnly ? "block" : "none" }}
        />
        {!audioOnly && (
          <video ref={remoteV} autoPlay playsInline style={{ width: 180 }} />
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        {/* Add notification UI for incoming call here if needed */}
        <button onClick={endCall} style={{ background: "#c00", color: "#fff" }}>
          ✖ End Call
        </button>
      </div>
    </div>
  );
}
