import { useRef, useState, useEffect } from "react";
import supabase from "../../../../Supabase.jsx";

/*---------------------------------------------------------
  signals helper
---------------------------------------------------------*/
const sendSignal = ({ roomId, from, to, type, payload }) =>
  supabase.from("signals").insert({
    room_id: roomId,
    from_user_id: from,
    to_user_id: to,
    type,
    payload,
  });

export default function CallPanel({
  roomId,
  selfId,
  peerId,
  onClose,
  audioOnly = false,
}) {
  const localV = useRef(null);
  const remoteV = useRef(null);
  const pc = useRef(null);

  const [incomingOffer, setIncomingOffer] = useState(null);
  const [accepted, setAccepted] = useState(false);

  const ensurePeerAndStream = async () => {
    if (pc.current) return;

    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.current.onicecandidate = (ev) => {
      if (ev.candidate)
        sendSignal({
          roomId,
          from: selfId,
          to: peerId,
          type: "candidate",
          payload: ev.candidate.toJSON(),
        });
    };

    pc.current.ontrack = (ev) => {
      remoteV.current.srcObject = ev.streams[0];
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      video: audioOnly ? false : true,
      audio: true,
    });
    localV.current.srcObject = stream;
    stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));
  };

  useEffect(() => {
    (async () => {
      await ensurePeerAndStream();

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);

      await sendSignal({
        roomId,
        from: selfId,
        to: peerId,
        type: "offer",
        payload: offer,
      });
    })();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const chan = supabase
      .channel(`sig-${roomId}-${selfId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
          filter: `room_id=eq.${roomId}`,
        },
        async ({ new: sig }) => {
          const { type, payload, from_user_id, to_user_id } = sig;
          if (
            type === "offer" &&
            to_user_id === selfId &&
            from_user_id !== selfId &&
            !incomingOffer &&
            new Date(sig.created_at) > new Date(Date.now() - 1000 * 60) // only last minute
          ) {
            setIncomingOffer({ sdp: payload, from: from_user_id });
          } else if (type === "answer") {
            await pc.current?.setRemoteDescription(payload);
          } else if (type === "candidate") {
            await pc.current?.addIceCandidate(payload);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(chan);
  }, [roomId, selfId]);

  const acceptCall = async () => {
    setAccepted(true);
    const offer = incomingOffer.sdp;
    await ensurePeerAndStream();

    await pc.current.setRemoteDescription(offer);
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);

    await sendSignal({
      roomId,
      from: selfId,
      to: incomingOffer.from,
      type: "answer",
      payload: answer,
    });
  };

  const endCall = async () => {
    try {
      pc.current?.close();
    } catch (_) {}
    if (localV.current?.srcObject) {
      localV.current.srcObject.getTracks().forEach((t) => t.stop());
      localV.current.srcObject = null;
    }
    if (remoteV.current?.srcObject) {
      remoteV.current.srcObject.getTracks().forEach((t) => t.stop());
      remoteV.current.srcObject = null;
    }

    await supabase
      .from("signals")
      .update({ ended_at: new Date().toISOString() })
      .eq("room_id", roomId);

    onClose();
  };

  useEffect(() => endCall, []); // run on unmount

  return (
    <div className="call-box">
      {incomingOffer && !accepted && (
        <div className="incoming-banner">
          Incoming call…
          <button onClick={acceptCall}>Accept</button>
          <button onClick={endCall}>Decline</button>
        </div>
      )}

      {!audioOnly ? (
        <>
          <video ref={localV} autoPlay muted playsInline />
          <video ref={remoteV} autoPlay playsInline />
        </>
      ) : (
        <>
          <audio ref={localV} autoPlay muted />
          <audio ref={remoteV} autoPlay />
        </>
      )}

      <button onClick={endCall}>✖ End Call</button>
    </div>
  );
}
