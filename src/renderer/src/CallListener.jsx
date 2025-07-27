import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "./UserContext";
import supabase from "../Supabase.jsx";
// import SimplePeer from "simple-peer";
import CallToast from "./components/UI Components/CallToast/CallToast";
import SimplePeer from "simple-peer";

function CallListener() {
  const { id, inCall, setInCall, peerRef, remoteUserId, setRemoteUserId, remotePeerRef } =
    useContext(UserContext);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);

  // Incoming call listener
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
          filter: `to_user_id=eq.${id}`,
        },
        async (payload) => {
            
          console.log("detected incoming signal!");
          setInCall(true)
          const { room_id, from_user_id, payload: offerPayload } = payload.new;
          const signal = offerPayload;
          remotePeerRef.current = new SimplePeer({ receiver, trickle: false });
          remotePeerRef.current.signal(signal)
          setIncomingCall({
            room_id,
            caller_id: from_user_id,
            receiver: true,
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  useEffect(() => {
    console.log(incomingCall);
  }, [incomingCall]);

  // create peer on mount
  useEffect(() => {
    if (inCall === false) return;

    const randId = crypto.randomUUID();
    peerRef.current = new SimplePeer({
      initiator: true,
      trickle: true,
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

    peerRef.current.on("signal", async (data) => {
      const { error } = await supabase
        .from("signals")
        .insert({
          room_id: randId,
          from_user_id: id,
          to_user_id: remoteUserId,
          payload: JSON.stringify(data),
        })
        .select()
        .single();

      if (error) {
        console.log(`Error calling user: ${error.message}`);
        return;
      }
    });
  }, [inCall, remoteUserId]);

  // end call listener
  useEffect(() => {
    const inChannel = supabase.channel("incoming-calls").on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "signals",
        filter: `to-user-id=eq.${id}`,
      },
      () => {
        setIncomingCall(null);
        setRemoteUserId(null);
      }
    );

    return () => {
      supabase.removeChannel(inChannel);
    };
  }, [inCall]);

  if (incomingCall) {
    return (
      <CallToast
        room_id={incomingCall.room_id}
        caller_id={incomingCall.caller_id}
        receiver={incomingCall.receiver}
        payload={incomingCall.payload}
      />
    );
  } else if (outgoingCall) {
    return (
      <CallToast
        room_id={outgoingCall.room_id}
        callee_id={outgoingCall.callee_id}
        receiver={outgoingCall.receiver}
        payload={outgoingCall.payload}
      />
    );
  }
}

export default CallListener;
