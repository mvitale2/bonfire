import { useContext, useEffect } from "react";
import supabase from "../../../../Supabase";
import { UserContext } from "../../../UserContext";
import { useNavigate } from "react-router-dom";

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

    const channel = supabase.channel("incoming-calls").on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "signals",
        filter: `to_user_id=eq.${id}`,
      },
      (payload) => {
        const { room_id, from_user_id } = payload.new;
        if (window.confirm(`Incoming call from ${from_user_id}. Accept?`)) {
          navigate(`/call/${room_id}`);
        } else {
          handleEndCall();
        }
      }
    );
  });

  return null;
}

export default CallListener;
