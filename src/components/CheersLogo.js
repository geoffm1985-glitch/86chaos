import React from 'react';

const CheersLogo = ({ clientData }) => {
  const settings = clientData?.systemSettings || {};
  const branding = settings.branding || clientData?.branding || {};
  const logoUrl = settings.showRestaurantLogo === false || branding.showRestaurantLogo === false
    ? ''
    : (settings.restaurantLogoUrl || branding.restaurantLogoUrl || branding.logoUrl || '');
  return (
    <div className="brand-logo-stack chaos-brand-wordmark flex items-center gap-2 sm:gap-3 cursor-pointer transition-opacity hover:opacity-90 min-w-0">
      <div className="flex items-center gap-2 flex-shrink-0" title="86 Chaos branding is always displayed">
        <img src="/wisco.png" alt="86 Chaos app icon" className="h-8 w-8 sm:h-9 w-auto drop-shadow-[0_0_12px_rgba(255,122,26,0.26)]" />
        <img src="/6139.png" alt="86 Chaos" className="h-5 sm:h-6 w-auto" />
      </div>
      {logoUrl && (
        <div className="hidden sm:flex items-center gap-2 min-w-0 pl-2 border-l border-[#2A353D]">
          <img src={logoUrl} alt="Restaurant logo" className="h-8 sm:h-9 max-w-[92px] sm:max-w-[140px] object-contain rounded-md bg-white/5 p-1" />
        </div>
      )}
    </div>
  );
};

export default CheersLogo;
