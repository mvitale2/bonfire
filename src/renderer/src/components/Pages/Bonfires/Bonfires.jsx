import { useContext, useState, useEffect, useRef } from "react";
import supabase from "../../../../Supabase";
import { UserContext } from "../../../UserContext";
import { IoMdAdd } from "react-icons/io";
import Avatar from "../../UI Components/Avatar/Avatar";
import Combobox from "react-widgets/Combobox";
import "./Bonfires.css";

function Bonfires() {
  const { id } = useContext(UserContext);
  const [roomId, setRoomId] = useState("");

  function ActiveBonfires() {
    const [bonfires, setBonfires] = useState({});

    // fetch bonfires in real time
    useEffect(() => {
      const fetchBonfires = async () => {
        const { data, error } = await supabase.from("bonfires").select("*");

        if (error) {
          console.log(`Error fetching bonfires: ${error.message}`);
          // add ui error message logic
          return;
        }

        console.log(data.length);

        setBonfires(data);
      };

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
            // gonna need logic for extracting joined members maybe?
            fetchBonfires();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, []);

    return (
      <div className="bonfires-wrapper">
        {bonfires.length > 0
          ? bonfires.map((bonfire) => (
              <div className="bonfire" id={bonfire.room_id}>
                <p className="bonfire-title">{bonfire.name}</p>
                <button className="bonfire-join-btn">Join</button>
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
      const { data, error } = await supabase
        .from("bonfires")
        .insert({ name: bonfireName })
        .select("room_id")
        .single();

      if (error) {
        console.log(`Error uploading bonfire: ${error.message}`);
        // add logic for setting an error message
        return;
      }

      setRoomId(data.room_id);
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
