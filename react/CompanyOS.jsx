// React/Next wrapper for the Company OS dashboard.
// Usage:
//   import CompanyOS from "company-os/react";
//   import "company-os/style.css";
//   <CompanyOS data={myCompanyOsData} />
//
// It wraps the same framework-agnostic core renderer, so there is one source of
// truth for the rendering. The dashboard is scoped under .cos and will not touch
// the host app's styles.
import { useEffect, useRef } from "react";
import * as Core from "../company-os.core.js";

const CompanyOSCore = Core.default || Core;

export default function CompanyOS({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = CompanyOSCore.render(data || {});
  }, [data]);
  return <div className="cos" ref={ref} />;
}
