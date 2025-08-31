import { useContext, useState, useEffect, useRef } from "react";
import supabase from "../../../../Supabase";
import { UserContext } from "../../../UserContext";
import { IoMdAdd } from "react-icons/io";
import Avatar from "../../UI Components/Avatar/Avatar";
import "./Bonfires.css";

function Bonfires() {
  const { id, inCall, inGroupCall, setInGroupCall } = useContext(UserContext);
  const [roomId, setRoomId] = useState("");

  function ActiveBonfires() {
    const [bonfires, setBonfires] = useState([]);

    const fetchBonfires = async () => {
      const { data, error } = await supabase.from("bonfires").select("*");

      if (error) {
        console.log(`Error fetching bonfires: ${error.message}`);
        // add ui error message logic
        return;
      }

      setBonfires(data);
    };

    // fetch bonfires in real time
    useEffect(() => {
      fetchBonfires();

      const channel = supabase
        .channel("bonfire-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bonfires",
          },
          () => {
            fetchBonfires();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [inGroupCall[0]]);

    const handleJoin = async (bonfireId) => {
      setInGroupCall([true, bonfireId]);
      setRoomId(bonfireId);

      const { data, error } = await supabase
        .from("bonfires")
        .select("joined_users")
        .eq("room_id", bonfireId)
        .single();

      if (error) {
        console.log(`Error retrieving joined users: ${error.message}`);
        return;
      }

      let updatedUsers = Array.isArray(data.joined_users)
        ? [...data.joined_users]
        : [];

      if (!updatedUsers.includes(id)) {
        updatedUsers.push(id);
      }

      const { error: updateError } = await supabase
        .from("bonfires")
        .update({ joined_users: updatedUsers })
        .eq("room_id", bonfireId);

      if (updateError) {
        console.log(`Error updating joined users: ${updateError.message}`);
      } else {
        fetchBonfires();
      }
    };

    return (
      <div className="bonfires-wrapper">
        {bonfires.length > 0
          ? bonfires.map((bonfire) => (
              <div className="bonfire" key={bonfire.room_id}>
                <p className="bonfire-title">{bonfire.name}</p>
                <button
                  className="bonfire-join-btn"
                  onClick={async () => await handleJoin(bonfire.room_id)}
                  disabled={inCall || inGroupCall[0]}
                >
                  Join
                </button>
                <div className="joined-users">
                  {Array.isArray(bonfire.joined_users) &&
                  bonfire.joined_users.length > 0
                    ? bonfire.joined_users.map((user) => {
                        return <Avatar otherUserId={user} key={user} />;
                      })
                    : null}
                </div>
              </div>
            ))
          : null}
      </div>
    );
  }

  function CreateNewBonfire() {
    const [bonfireName, setBonfireName] = useState("");
    const [creatingBonfire, setCreatingBonfire] = useState(false);
    const inputRef = useRef();

    useEffect(() => {
      // console.log("Focusing input...");
      inputRef.current?.focus();
    }, [bonfireName]);

    const handleAddBonfire = async () => {
      const { error } = await supabase
        .from("bonfires")
        .insert({ name: bonfireName, creator_id: id });

      if (error) {
        console.log(`Error uploading bonfire: ${error.message}`);
        // add logic for setting an error message
        return;
      }

      setCreatingBonfire(false);
      setBonfireName("");
    };

    return (
      <div className="new-bonfire-wrapper">
        <div className="new-section">
          <p>Create New Bonfire</p>
          <div className="add-btn" onClick={() => setCreatingBonfire(true)}>
            <IoMdAdd />
          </div>
        </div>
        <div
          className={`${!creatingBonfire ? "hide" : null} create-bonfire-panel`}
        >
          <label htmlFor="name-input" className="bonfire-name-input-label">
            Name:
            <input
              ref={inputRef}
              id="name-input"
              type="textfield"
              className="bonfire-name-input"
              value={bonfireName}
              maxLength={16}
              onChange={(e) => setBonfireName(e.target.value)}
            />
          </label>
          <button
            className="create-btn"
            onClick={async () => {
              await handleAddBonfire();
            }}
          >
            Create Bonfire
          </button>
          <button
            className="cancel-create-btn"
            onClick={() => {
              setCreatingBonfire(false);
              setBonfireName("");
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bonfires">
      <CreateNewBonfire />
      <ActiveBonfires />
    </div>
  );
}

export default Bonfires;
