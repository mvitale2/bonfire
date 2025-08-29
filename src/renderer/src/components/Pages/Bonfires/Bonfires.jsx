import { useContext, useState, useEffect } from "react";
import supabase from "../../../../Supabase";
import { UserContext } from "../../../UserContext";
import { IoMdAdd } from "react-icons/io";
import Avatar from "../../UI Components/Avatar/Avatar";
import Combobox from "react-widgets/Combobox"
import "./Bonfires.css";

function Bonfires() {
  const { id } = useContext(UserContext)
  const [input, setInput] = useState("");
  const [bonfireName, setBonfireName] = useState("")
  const [bonfires, setBonfires] = useState();
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [users, setUsers] = useState()
  const [creatingBonfire, setCreatingBonfire] = useState(false);

  useEffect(() => {
    if (!input) return;

    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("nickname, public_id")
        .ilike("nickname", `%${input}%`);

      if (error) {
        console.log(`Error occured while fetching users: ${error}`);
      }

      setUsers(data || []);
    };

    fetchUsers();
  }, [input]);

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

  function ActiveBonfires() {}

  function CreateNewBonfire() {
    return (
      <div className="new-bonfire-wrapper">
        <p>Create New Bonfire</p>
        <div className="add-btn" onClick={() => setCreatingBonfire(true)}>
          <IoMdAdd />
        </div>
        <div className={`${!creatingBonfire ? "hide" : null} create-bonfire-panel`}>
          <label htmlFor="name-input" className="bonfire-name-input-label">
            Name:
            <input id="name-input" type="textfield" className="bonfire-name-input" value={bonfireName} onChange={(e) => setBonfireName(e)}/>
          </label>
          <p className="bonfire-add-members-label">
            Allowed Members:
          </p>
          {/* make it so that when a user is selected it adds them to an array (which also resets the input), which is uploaded to supabase */}
          {/* also need a checkbox for allowing anyone to join */}
          <Combobox
            data={users}
            hideCaret
            textField={(user) =>
              typeof user === "object" &&
              user !== null &&
              user.nickname &&
              user.public_id
                ? `${user.nickname}#${user.public_id.slice(0, 6)}`
                : user || ""
            }
            onChange={(value) => setInput(value)}
            onSelect={async (user) => {
              setSelectedUser(user);
              if (user.public_id === id) {
                setDisableRequest(true);
              } else {
                (async () => {
                  const alreadyRequested = await checkForRequest(
                    user.public_id
                  );
                  const alreadyFriend = await checkIfFriend(user.public_id);
                  setDisableRequest(alreadyRequested || alreadyFriend);
                })();
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bonfires">
      <ActiveBonfires />
      <CreateNewBonfire />
    </div>
  );
}

export default Bonfires;
