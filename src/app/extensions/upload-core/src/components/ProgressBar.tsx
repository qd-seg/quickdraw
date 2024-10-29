import * as React from 'react';

interface ProgressBarProperties {
  color: string;
  progress: number;
  height: number;
}

const ProgressBar: React.FC<ProgressBarProperties> = ({ color, progress, height }) => {
  const parentStyle: React.CSSProperties = {
    height: height,
    width: 'fit',
    backgroundColor: 'whitesmoke',
    borderRadius: 40,
    margin: 10,
  };

  const childStyle: React.CSSProperties = {
    height: '100%',
    width: `${progress}%`,
    backgroundColor: color,
    borderRadius: 40,
    textAlign: 'right',
  };

  const textStyle: React.CSSProperties = {
    padding: 10,
    color: 'black',
    fontWeight: 900,
  };

  return (
    <div style={parentStyle}>
      <div style={childStyle}>
        <span style={textStyle}>{`${progress}%`}</span>
      </div>
    </div>
  );
};

export default ProgressBar;
