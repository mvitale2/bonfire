import { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../../../UserContext";
import supabase from "../../../../Supabase";
import { MdCall, MdCallEnd, MdConnectWithoutContact } from "react-icons/md";
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

  // join room on mount
  useEffect(() => {
    joinRoom()
  }, [])

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
      stream,
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

    peer.on("signal", (data) => {
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: { type: "signal", to: otherId, from: id, data },
      });
    });

    peer.on("track", (track, stream) => {
      let element = document.querySelector(`audio[data-peer="${otherid}]`)
      if (!element) {
        element = document.createElement("audio")
        element.dataset.peer = otherId
        element.autoplay = true
        element.playsInLine = true
        document.body.appendChid(element)
      }
      element.srcObject = stream
    }
  );

    peer.on("close", () => {
      peersRef.current.delete(otherId);
      const element = document.querySelector(`audio[data-peer="${otherid}]`);
      if (element?.parentNode) element.parentNode.removeChild(element);
    });

    peer.on("error", (error) => console.log(`[peer ${otherId}]`, error));

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

  async function joinRoom() {
    await getLocalAudio();

    const channel = supabase.channel(`voice:room-${room_id}`, {
      config: { presence: { key: id } },
    });

    channel.on("broadcast", { event: "signal" }, (payload) => {
      const msg = payload.payload;
      if (msg.to !== id) return;
      let peer = peersRef.current.get(msg.from);
      if (!peer) {
        peer = createPeer(msg.from, false);
      }
      peer.signal(msg.data);
    });

    channel.on("presence", { event: "sycn" }, async () => {
      const state = channel.presenceState();
      const others = Object.keys(state).filter((id) => id !== id);

      // room size limit of 10
      if (others.length + 1 > 10) {
        // add logic for uploading full status to supabase
        console.log("room is full!");
        return;
      }

      for (const otherId of others) {
        if (!peersRef.current.has(otherId) && isInitiatorFor(otherId)) {
          createPeer(otherId, true);
        }
      }

      for (const existingId of Array.from(peersRef.current.keys())) {
        if (!others.includes(existingId)) {
          destroyPeer(existingId);
        }
      }

      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            peerId: id,
            displayName: "Me",
          });
          setConnected(true);
        }
      });
    });

    channelRef.current = channel;

    window.addEventListener("beforeunload", () => {
      channel.untrack();
    });
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
    await leaveRoom();

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
