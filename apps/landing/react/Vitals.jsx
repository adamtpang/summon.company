// React/Next wrapper for the Vitals dashboard.
// Usage:
//   import Vitals from "vitals/react";
//   import "vitals/style.css";
//   <Vitals data={myVitalsData} />
//
// It wraps the same framework-agnostic core renderer, so there is one source of
// truth for the rendering. The dashboard is scoped under .vitals and will not
// touch the host app's styles.
import { useEffect, useRef } from "react";
import * as Core from "../vitals.core.js";

const VitalsCore = Core.default || Core;

export default function Vitals({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = VitalsCore.render(data || {});
  }, [data]);
  return <div className="vitals" ref={ref} />;
}
