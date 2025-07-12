// src/hooks/useSignal.js
import supabase from "../../../../Supabase.jsx";

export function useSignal(roomId, selfId, onRemote) {
  // 1. listen
  useEffect(() => {
    if (!roomId) return;
    const chan = supabase
      .channel(`signal-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const s = payload.new;
          if (s.from_user_id === selfId) return;            // ignore own
          onRemote(s);                                      // push up
        }
      )
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, [roomId, selfId, onRemote]);

  // 2. send
  const send = async (toId, type, payload) =>
    supabase.from("signals").insert({
      room_id: roomId,
      from_user_id: selfId,
      to_user_id: toId,
      type,
      payload,
    });

  return { send };
}
