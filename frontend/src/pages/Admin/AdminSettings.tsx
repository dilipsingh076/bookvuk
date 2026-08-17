import Settings from "../Settings";

const AdminSettings = () => {
  // Render like a normal top-level page (same as Profile/Settings),
  // not inside the admin workspace layout.
  return <Settings />;
};

export default AdminSettings;

