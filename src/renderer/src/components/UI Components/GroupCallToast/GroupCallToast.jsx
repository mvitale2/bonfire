import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../../UserContext";
import supabase from "../../../../Supabase";
import { MdCallEnd, MdConnectWithoutContact } from "react-icons/md";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import Avatar from "../Avatar/Avatar";
import SimplePeer from "simple-peer";
import "./GroupCallToast.css";

function GroupCallToast({ room_id }) {
  const { id, inGroupCall, setInGroupCall } = useContext(UserContext);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const peersRef = useRef(new Map());
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);

  // join room on mount after getting local audio
  useEffect(() => {
    getLocalAudio().then(joinRoom());
  }, []);

  useEffect(() => {
    const loadPayload = (payload) => {
      const { from_user_id, payload: signal } = payload.new;
      console.log(`Loading detected signal from: ${from_user_id}`);
      console.log(signal);
      const parsedSignal =
        typeof signal === "string" ? JSON.parse(signal) : signal;
      console.log(parsedSignal);

      const peer = peersRef.current.get(from_user_id);
      if (peer) {
        peer.signal(parsedSignal);
      } else {
        console.log(`No peer found for user: ${from_user_id}`);
      }
    };

    const channel = supabase
      .channel(`bonfire-${room_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
          filter: `to_user_id=eq.${id}`,
        },
        (payload) => {
          loadPayload(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "signals",
          filter: `to_user_id=eq.${id}`,
        },
        (payload) => {
          loadPayload(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bonfires",
          filter: `room_id=eq.${room_id}`,
        },
        (payload) => {
          const { joined_users } = payload.new;
          console.log("Joined users changed");
          if (joined_users.length === 1 && joined_users[0] === id) {
            console.log("Logged in user is the only joined user");
            return;
          } else {
            createPeers(joined_users);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function isInitiatorFor(otherId) {
    return id > otherId;
  }

  async function getLocalAudio() {
    localStreamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  function createPeer(otherId, initiator) {
    if (peersRef.current.has(otherId)) return peersRef.current.get(otherId);

    const peer = new SimplePeer({
      initiator: initiator,
      trickle: true,
      stream: localStreamRef.current,
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

    peer.on("signal", async (data) => {
      console.log(`Sending offer to ${otherId}`);
      await supabase.from("signals").insert({
        room_id: room_id,
        from_user_id: id,
        to_user_id: otherId,
        payload: JSON.stringify(data),
      });
    });

    peer.on("stream", (stream) => {
      console.log(stream);
      let el = document.querySelector(`audio[data-peer="${otherId}"]`);
      if (!el) {
        el = document.createElement("audio");
        el.dataset.peer = otherId;
        el.autoplay = true;
        el.playsInline = true;
        document.body.appendChild(el);
      }
      el.srcObject = stream;
    });

    peer.on("connect", () => {
      console.log("Connected!");
      setConnected(true);
    });

    peer.on("close", () => {
      peersRef.current.delete(otherId);
      const element = document.querySelector(`audio[data-peer="${otherId}]`);
      if (element?.parentNode) element.parentNode.removeChild(element);
    });

    peer.on("error", (error) => console.log(`[peer ${otherId}]`, error));

    // add the peer to the ref
    peersRef.current.set(otherId, peer);

    return peer;
  }

  function destroyPeer(otherId) {
    const p = peersRef.current.get(otherId);
    if (p) {
      p.removeAllListeners();
      p.destroy();
      peersRef.current.delete(otherId);
    }
  }

  async function createPeers(users) {
    console.log(users);
    users.forEach(async (user) => {
      if (user != id) {
        const initiator = isInitiatorFor(user);
        createPeer(user, initiator);
      }
    });
  }

  async function joinRoom() {
    const { error, data } = await supabase
      .from("bonfires")
      .select("joined_users")
      .eq("room_id", room_id)
      .single();

    if (error) {
      console.log(`Error getting joined users: ${error.message}`);
      return;
    } else if (data.joined_users.length === 0) {
      console.log("No other joined users...");
      return;
    }

    console.log(data.joined_users);

    // if there are other users joined
    await createPeers(data.joined_users);
  }

  async function leaveRoom() {
    for (const id of Array.from(peersRef.current.keys())) destroyPeer(id);
    await channelRef.current?.untrack();
    await channelRef.current?.unsubscribe();
    peersRef.current.clear();
    setConnected(false);
  }

  function toggleMute() {
    setMuted((m) => {
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = m));
      return !m;
    });
  }

  const handleEndCall = async () => {
    setInGroupCall([false, null]);
    setConnected(false);
    await leaveRoom();

    const { error: deleteError } = supabase
      .from("signals")
      .delete()
      .eq("from_user_id", id)
      .eq("room_id", room_id);

    const { data, error } = await supabase
      .from("bonfires")
      .select("joined_users")
      .eq("room_id", room_id)
      .single();

    if (error) {
      console.log(`Error retrieving joined users: ${error.message}`);
      return;
    }

    let updatedUsers = Array.isArray(data.joined_users)
      ? [...data.joined_users]
      : [];

    updatedUsers = updatedUsers.filter((userId) => userId !== id);

    const { error: updateError } = await supabase
      .from("bonfires")
      .update({ joined_users: updatedUsers })
      .eq("room_id", room_id);

    if (updateError) {
      console.log(`Error updating joined users: ${updateError.message}`);
    }
  };

  return (
    <>
      <div className="call-toast-wrapper">
        <div className="status-icons">
          <div
            className={`connection-status ${connected ? "connected" : "disconnected"}`}
          >
            <MdConnectWithoutContact />
          </div>
        </div>
        <div className="call-avatar-div">
          <button
            className="end-call-btn"
            onClick={async () => await handleEndCall()}
          >
            <MdCallEnd />
          </button>
          <div className="mute-btn" onClick={toggleMute}>
            {muted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </div>
        </div>
      </div>
    </>
  );
}

export default GroupCallToast;
