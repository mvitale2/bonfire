import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "./UserContext";
import supabase from "../Supabase.jsx";
import CallToast from "./components/UI Components/CallToast/CallToast";
import SimplePeer from "simple-peer";

function CallListener() {
  const {
    id,
    inCall,
    setInCall,
    peerRef,
    setRemoteUserId,
    remoteUserId,
  } = useContext(UserContext);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [receiver, setReciver] = useState(false)
  const [roomId, setRoomId] = useState(null)

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
          setReciver(true)
          setInCall(true);
          const { room_id, from_user_id, payload: offerPayload } = payload.new;
          setIncomingCall({
            room_id,
            caller_id: from_user_id,
            receiver: true,
            payload: offerPayload,
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  useEffect(() => {
    console.log(incomingCall);
  }, [incomingCall]);

  // create peer on mount, or when inCall becomes true
  useEffect(() => {
    if (inCall === false || receiver) return;
    console.log("in call, creating local peer");

    const randId = crypto.randomUUID();
    setRoomId(randId)
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

      setOutgoingCall({
        room_id: randId,
        callee_id: remoteUserId,
        initiator: true,
      });
    });
  }, [inCall, remoteUserId]);

  useEffect(() => {
    console.log(outgoingCall)
  }, [outgoingCall])

  // end call listener
  useEffect(() => {
    if (!roomId) return;

    const inChannel = supabase.channel("incoming-calls").on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "signals",
        filter: `room_id=eq.${roomId}`,
      }, () => {
        console.log("Call ended!")
        setIncomingCall(null)
        setOutgoingCall(null)
        setInCall(false)
      }
    );

    return () => {
      supabase.removeChannel(inChannel);
    };
  }, [roomId]);

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
        initiator={outgoingCall.initiator}
      />
    );
  }
}

export default CallListener;
