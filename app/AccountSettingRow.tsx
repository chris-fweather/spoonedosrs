import type {ReactNode} from "react";

/** One account setting: title and a one-line description on the left, its control on the right. A status line sits under the text. */
export function AccountSettingRow({title, description, status, children, className}: {title: string; description: ReactNode; status?: ReactNode; children: ReactNode; className?: string}) {
  return <div className={"account-setting-row" + (className ? " " + className : "")}>
    <div className="account-setting-copy">
      <h3>{title}</h3>
      <p>{description}</p>
      {status}
    </div>
    <div className="account-setting-control">{children}</div>
  </div>;
}
