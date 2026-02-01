import Header from "./header/index.jsx";
import Main from "./main/index.jsx";
import { useLocation, useNavigate } from "solid-app-router";

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // console.log("App navigate", navigate);
  // console.log("App location", location);

  if (location.pathname === "/index.html") {
    navigate("/", { replace: true });
  }

  return (
    <>
      <Header />
      <Main />
    </>
  );
};

export default App;
