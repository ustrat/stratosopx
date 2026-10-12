import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { ControlProvider } from "./components/Controls";
import { Layout } from "./components/Layout";
import { Audit } from "./pages/Audit";
import { Placeholder } from "./pages/common";
import { ErpSync } from "./pages/ErpSync";
import { OrderList, OrderReview } from "./pages/Orders";
import { Overview } from "./pages/Overview";
import { Settings } from "./pages/Settings";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ControlProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="review" element={<OrderList mode="open" />} />
            <Route path="review/:id" element={<OrderReview />} />
            <Route path="orders" element={<OrderList mode="all" />} />
            <Route path="erp-sync" element={<ErpSync />} />
            <Route path="settings" element={<Settings />} />
            <Route path="audit" element={<Audit />} />
            <Route
              path="bids"
              element={<Placeholder title="Bids & RFPs" summary="Go / No-Go decisions, dealbreaker clauses and compliance matrices." />}
            />
            <Route path="*" element={<Placeholder title="Page not found" summary="That page doesn't exist." />} />
          </Route>
        </Routes>
      </ControlProvider>
    </BrowserRouter>
  </StrictMode>,
);
