import { createBrowserRouter } from "react-router";
import { DashboardLayout } from "./layouts/DashboardLayout";
import Notebooks from "./pages/Notebooks";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Exam from "./pages/Exam";
import Upload from "./pages/Upload";
import Settings from "./pages/Settings";

export const router = createBrowserRouter([
  { path: "/", Component: Notebooks },
  {
    path: "/notebook/:notebookId",
    Component: DashboardLayout,
    children: [
      { index: true, Component: Home },
      { path: "chat", Component: Chat },
      { path: "exam", Component: Exam },
      { path: "upload", Component: Upload },
      { path: "settings", Component: Settings },
    ],
  },
]);

