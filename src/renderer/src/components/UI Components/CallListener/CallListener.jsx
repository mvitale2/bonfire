import { useContext, useEffect } from "react";
import supabase from "../../../../Supabase";
import { UserContext } from "../../../UserContext";
import { useNavigate } from "react-router-dom";
import getNickname from "../../../getNickname";

function CallListener() {
  const { id } = useContext(UserContext);
  const navigate = useNavigate();

  const handleEndCall = async (room) => {
    const { error } = await supabase
      .from("signals")
      .delete()
      .eq("room_id", room);

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
          event: "UPDATE",
          schema: "public",
          table: "signals",
          filter: `to_user_id=eq.${id}`,
        },
        async (payload) => {
          const {
            type,
            room_id,
            from_user_id,
            payload: offerPayload,
          } = payload.new;
          if (type === "offer") {
            const nickname = await getNickname(from_user_id);
            if (
              window.confirm(
                `Incoming call from ${nickname}#${from_user_id.slice(0, 6)}. Accept?`
              )
            ) {
              navigate(`/call/${room_id}?accepting=true`);
            } else {
              handleEndCall(room_id);
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  });

  return null;
}

export default CallListener;
