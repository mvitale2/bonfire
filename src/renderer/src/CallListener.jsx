import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "./UserContext";
import supabase from "../Supabase.jsx";
// import SimplePeer from "simple-peer";
import CallToast from "./components/UI Components/CallToast/CallToast";

function CallListener() {
  const { id, inCall, peerRef } = useContext(UserContext);
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
  }, [inCall, id]);

  // Outgoing call listener (user initiates a call)
  useEffect(() => {
    const channel = supabase.channel("outgoing-calls").on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "signals",
        filter: `from-user-id=eq.${id}`,
      },
      async (payload) => {
        const {
          room_id,
          to_user_id,
          payload: offerPayload,
        } = payload.new;
        setOutgoingCall({
          room_id,
          callee_id: to_user_id,
          payload: offerPayload,
          initiator: true,
        });
      }
    );

    return () => supabase.removeChannel(channel);
  }, [inCall, id]);

  // end call listener
  useEffect(() => {
    const outChannel = supabase.channel("outgoing-calls").on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "signals",
        filter: `from-user-id=eq.${id}`,
      },
      () => {
        setOutgoingCall(null);
      }
    );

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
      }
    );

    return () => {
      supabase.removeChannel(outChannel);
      supabase.removeChannel(inChannel);
    };
  }, [inCall]);

  if (inCall && receiver) {
    return (
      <CallToast
        room_id={incomingCall.room_id}
        caller_id={incomingCall.caller_id}
        receiver={incomingCall.receiver}
        payload={incomingCall.payload}
      />
    );
  } else if (inCall && initiator) {
    return (
      <CallToast
        room_id={outgoingCall.room_id}
        callee_id={outgoingCall.callee_id}
        receiver={outgoingCall.receiver}
        payload={outgoingCall.payload}
      />
    );
  } else {
    return null;
  }
}

export default CallListener;
