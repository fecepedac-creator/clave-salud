import React, { useState } from "react";

interface BackgroundImageProps {
  src: string;
  fallbackSrc: string;
  alt?: string;
  children?: React.ReactNode;
  className?: string;
}

export const BackgroundImage: React.FC<BackgroundImageProps> = ({
  src,
  fallbackSrc,
  alt = "Background",
  children,
  className = "",
}) => {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <div className={`relative ${className}`}>
      <img
        src={imgSrc}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setImgSrc(fallbackSrc)}
      />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
};
