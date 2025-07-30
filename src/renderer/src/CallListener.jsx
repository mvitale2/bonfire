import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "./UserContext";
import supabase from "../Supabase.jsx";
import CallToast from "./components/UI Components/CallToast/CallToast";

function CallListener() {
  const { id, inCall, setInCall, remoteUserId } = useContext(UserContext);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [receiver, setReciver] = useState(false);

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
          if (payload.new.type === "initial") {
            console.log("user is receiver");
            setReciver(true);
            setInCall(true);
            const { room_id, from_user_id } = payload.new;
            setIncomingCall({
              room_id: room_id,
              remote_id: from_user_id,
              initiator: false,
            });
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  useEffect(() => {
    console.log(incomingCall);
  }, [incomingCall]);

  useEffect(() => {
    if (inCall === false || receiver === true || !remoteUserId) return;
    console.log("user is initiator");
    console.log("Initiating call toast with", remoteUserId);
    const randId = crypto.randomUUID();
    setOutgoingCall({
      room_id: randId,
      remote_id: remoteUserId,
      initiator: true,
    });
  }, [inCall, receiver]);

  useEffect(() => {
    console.log(outgoingCall);
  }, [outgoingCall]);

  // end call listener
  useEffect(() => {
    if (inCall === true) return;
    console.log("Call ended!");
    setIncomingCall(null);
    setOutgoingCall(null);
  }, [inCall, remoteUserId]);

  if (incomingCall) {
    return (
      <CallToast
        room_id={incomingCall.room_id}
        remote_id={incomingCall.remote_id}
        initiator={incomingCall.initiator}
        payload={incomingCall.payload}
      />
    );
  } else if (outgoingCall) {
    return (
      <CallToast
        room_id={outgoingCall.room_id}
        remote_id={outgoingCall.remote_id}
        initiator={outgoingCall.initiator}
      />
    );
  }
}

export default CallListener;
