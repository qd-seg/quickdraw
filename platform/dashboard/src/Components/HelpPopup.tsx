import React, { ReactNode } from 'react';

interface PopupProps {
  show: boolean;
  children: ReactNode;
}

const HelpPopup = ({ show, children }: PopupProps) => {
  if (!show) {
    return null;
  }

  return <div id="help-popup">{children}</div>;
};

export default HelpPopup;
