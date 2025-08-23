import { useContext, useState, useEffect } from "react";
import supabase from "../../../../Supabase";
import { UserContext } from "../../../UserContext";
import { IoMdAdd } from "react-icons/io";
import Avatar from "../../UI Components/Avatar/Avatar";
import "./Bonfires.css";

function Bonfires() {
  const [voiceChannels, setVoiceChannels] = useState();
  const [creatingChannel, setCreatingChannel] = useState(false);

  useEffect(() => {
    const fetchBonfires = async () => {
      const { data, error } = await supabase.from("bonfires").select("*");

      if (error) {
        console.log(`Error retrieving bonfires: ${error.message}`);
      }

      if (Array.isArray(data) && data.length > 0) {
        setVoiceChannels(data)
      }
    };

    fetchBonfires();
  }, []);

  function VoiceChannel() {}

  function ActiveVoiceChannels() {}

  function CreateNewChannel() {
    return (
      <div className="new-channel-wrapper">
        <p>Create New Bonfire</p>
        <div className="add-btn" onClick={() => setCreatingChannel(true)}>
          <IoMdAdd />
        </div>
        <div
          className={`create-channel-wrapper ${creatingChannel ? null : "hide"}`}
        ></div>
      </div>
    );
  }

  return (
    <div className="bonfires">
      <ActiveVoiceChannels />
      <CreateNewChannel />
    </div>
  );
}

export default Bonfires;
