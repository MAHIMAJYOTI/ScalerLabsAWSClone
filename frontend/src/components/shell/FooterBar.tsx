"use client";

import {
  colorBackgroundHomeHeader,
  colorTextHomeHeaderSecondary,
  fontFamilyBase,
} from "@cloudscape-design/design-tokens";

// The console footer stays dark in both visual modes (like the top nav), so
// the static "home header" design tokens are the right fit. The font family
// must come from the token too — the footer sits outside AppLayout, so it
// doesn't inherit the Cloudscape font stack and would fall back to serif.
const footerStyle: React.CSSProperties = {
  background: colorBackgroundHomeHeader,
  color: colorTextHomeHeaderSecondary,
  fontFamily: fontFamilyBase,
};

export function FooterBar() {
  return (
    <footer id="r53-footer" className="r53-footer" style={footerStyle}>
      <div className="r53-footer-group">
        <button type="button">CloudShell</button>
        <button type="button">Feedback</button>
      </div>
      <div className="r53-footer-group">
        <span>
          © 2026, Demo clone – not affiliated with Amazon Web Services
        </span>
        <a href="#" onClick={(event) => event.preventDefault()}>
          Privacy
        </a>
        <a href="#" onClick={(event) => event.preventDefault()}>
          Terms
        </a>
        <a href="#" onClick={(event) => event.preventDefault()}>
          Cookie preferences
        </a>
      </div>
    </footer>
  );
}
