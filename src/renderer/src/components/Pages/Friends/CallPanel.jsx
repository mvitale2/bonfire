// src/renderer/src/components/Pages/Friends/CallPanel.jsx
import { useEffect, useRef } from "react";
import supabase from "../../../../Supabase.jsx";

export default function CallPanel({ roomId, selfId, peerId, onClose }) {
  /** video & peer refs */
  const localV = useRef(null);
  const remoteV = useRef(null);
  const pc = useRef(null);

  /* --- helper: push signal row --- */
  const send = (type, payload) =>
    supabase.from("signals").insert({
      room_id: roomId,
      from_user_id: selfId,
      to_user_id: peerId,
      type,
      payload,
    });

  /* --- helper: create / reuse peer + local media --- */
  const ensurePeerAndStream = async () => {
    if (pc.current) return; // already done
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.current.ontrack = (ev) => {
      remoteV.current.srcObject = ev.streams[0];
    };

    pc.current.onicecandidate = (ev) => {
      if (ev.candidate) send("candidate", ev.candidate.toJSON());
    };

    // camera + mic
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));
    localV.current.srcObject = stream;
  };

  /* ──────────────────────────────────────────────────────────
     1. outgoing offer (caller)
  ────────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      await ensurePeerAndStream();

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      send("offer", offer); // write to DB
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  /* ──────────────────────────────────────────────────────────
     2. listen for all signals on this room
  ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const chan = supabase
      .channel(`sig-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
          filter: `room_id=eq.${roomId}`,
        },
        async (pl) => {
          const s = pl.new;
          if (s.from_user_id === selfId) return; // ignore myself
          await ensurePeerAndStream(); // make sure peer+stream exist

          if (s.type === "answer") {
            await pc.current.setRemoteDescription(s.payload);
          } else if (s.type === "candidate") {
            await pc.current.addIceCandidate(s.payload);
          } else if (s.type === "offer") {
            // I'm the callee receiving first offer
            await pc.current.setRemoteDescription(s.payload);
            const ans = await pc.current.createAnswer();
            await pc.current.setLocalDescription(ans);
            send("answer", ans);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(chan);
  }, [roomId, selfId]);

  /* ────────────────────────────────────────────────────────── */
  return (
    <div className="call-box">
      <video ref={localV} autoPlay muted playsInline />
      <video ref={remoteV} autoPlay playsInline />
      <button
        onClick={() => {
          pc.current.close();
          onClose();
        }}
      >
        ✖ End Call
      </button>
    </div>
  );
}
