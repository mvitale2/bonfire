import { useContext, useEffect } from "react";
import supabase from "../../../../Supabase";
import { UserContext } from "../../../UserContext";
import { useNavigate } from "react-router-dom";
import getNickname from "../../../getNickname";

function CallListener() {
  const { id } = useContext(UserContext);
  const navigate = useNavigate();

  const handleEndCall = async () => {
    const { error } = await supabase
      .from("signals")
      .delete()
      .eq("room_id", roomId);

    if (error) {
      console.log(`Error ending call: ${error.message}`);
    }
  };

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
          const { room_id, from_user_id, payload: offerPayload } = payload.new;
          const nickname = await getNickname(from_user_id);
          if (
            window.confirm(
              `Incoming call from ${nickname}#${from_user_id.slice(0, 6)}. Accept?`
            )
          ) {
            const pc = new RTCPeerConnection({
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });

            await pc.setRemoteDescription(
              new RTCSessionDescription(offerPayload)
            );

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            const { error } = await supabase
              .from("signals")
              .insert({
                room_id: room_id,
                from_user_id: id,
                to_user_id: from_user_id,
                type: "answer",
                payload: {
                  type: answer.type,
                  sdp: answer.sdp,
                },
              })
              .select()
              .single();

            if (error) {
              console.log(`Error answering user: ${error.message}`);
              return;
            }
            navigate(`/call/${room_id}?accepting=true`);
          } else {
            handleEndCall();
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  });

  return null;
}

export default CallListener;
