import React from 'react';

const CheersLogo = () => {
  return (
    <div className="brand-logo-stack flex items-center gap-2 sm:gap-3 cursor-pointer transition-opacity hover:opacity-80 min-w-0">
      <div className="flex items-center gap-2 flex-shrink-0">
        <img src="/wisco.png" alt="86 Chaos app icon" className="h-8 w-8 sm:h-9 w-auto" />
        <img src="/6139.png" alt="86 Chaos" className="h-5 sm:h-6 w-auto" />
      </div>
    </div>
  );
};

export default CheersLogo;
