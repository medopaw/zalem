import React, { useState } from 'react';
import Chat from './Chat';
import Reports from './Reports';
import DraggableResizer from '../components/DraggableResizer';

const MIN_LEFT_WIDTH = 565;
const MIN_RIGHT_WIDTH = 300;

function Home() {
  const [leftWidth, setLeftWidth] = useState(() => window.innerWidth - 400);

  return (
    <div className="h-full overflow-auto flex gap-1">
      <div style={{ width: leftWidth, minWidth: MIN_LEFT_WIDTH }}>
        <Chat />
      </div>
      <DraggableResizer
        onResize={setLeftWidth}
        minLeftWidth={MIN_LEFT_WIDTH}
        minRightWidth={MIN_RIGHT_WIDTH}
      />
      <div style={{ width: `calc(100% - ${leftWidth}px - 3px)`, minWidth: MIN_RIGHT_WIDTH }}>
        <Reports />
      </div>
    </div>
  );
}

export default Home;
